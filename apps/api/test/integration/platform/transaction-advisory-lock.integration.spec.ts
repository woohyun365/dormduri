import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client, Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { PrismaClient, type Prisma } from '../../../src/generated/prisma/client.js';
import { acquireTransactionAdvisoryLock } from '../../../src/generated/prisma/sql.js';

const RUN_ID = randomUUID();
const TRANSACTION_MS = 20_000;
const OBSERVATION_MS = 2_000;
// Conservative bound: setup 15s + longest sequential body <150s + cleanup 50s.
// Keep teardown inside this spec's budget; do not widen the shared integration config.
const TEST_MS = 240_000;
const ROLLBACK = new Error('intentional advisory-lock test rollback');
type Key = { namespace: string; value: string };
type Lock = { pid: number; granted: boolean; mode: string };
type Acquire = (tx: Prisma.TransactionClient, key: Key) => Promise<void>;

function signal<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function bounded<T>(promise: Promise<T>, label: string, milliseconds = 5_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} deadline exceeded`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// No application/schema fixture: only transaction-local locks on synthetic keys.
async function withSessions(
  run: (sessions: ReturnType<typeof createSessions>) => Promise<void>,
  afterObserverConnected?: () => void,
) {
  const sessions = createSessions(afterObserverConnected);
  const failures: unknown[] = [];
  try {
    await sessions.connect();
    await run(sessions);
  } catch (error) {
    failures.push(error);
  } finally {
    failures.push(...(await sessions.close()));
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'Advisory-lock test/cleanup failed');
}

function connectionConfig() {
  // Match the existing integration target convention; never log credentials.
  const url = new URL(
    process.env.DATABASE_URL ??
      'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public',
  );
  // Own finite session settings rather than inheriting unbounded URL overrides.
  url.searchParams.delete('options');
  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 11_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: TRANSACTION_MS,
    options: '-c default_transaction_read_only=on',
    application_name: `knu_advisory_test_${RUN_ID}`,
  };
}

function createSessions(afterObserverConnected?: () => void) {
  const config = connectionConfig();
  const disposals: { label: string; close: () => Promise<void> }[] = [];
  const releases: (() => void)[] = [];
  const pending: Promise<unknown>[] = [];
  const errors: unknown[] = [];
  let a: PrismaClient;
  let b: PrismaClient;
  let observer: Client;

  const track = <T>(promise: Promise<T>) => {
    pending.push(promise);
    // Observe immediately, even if an assertion fails before the caller awaits it.
    void promise.catch(() => undefined);
    return promise;
  };
  const transaction = <T>(
    client: PrismaClient,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => track(client.$transaction(work, { maxWait: 5_000, timeout: TRANSACTION_MS }));

  function prisma() {
    const pool = new Pool({ ...config, max: 1 });
    disposals.push({ label: 'pool', close: () => pool.end() });
    pool.on('error', (error) => errors.push(error));
    const client = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: false }),
    });
    disposals.push({ label: 'Prisma client', close: () => client.$disconnect() });
    return client;
  }

  function hold(
    client: PrismaClient,
    key: Key,
    acquire: Acquire,
    ending: 'commit' | 'rollback' = 'commit',
  ) {
    const entered = signal<number>();
    const acquired = signal<void>();
    const release = signal<void>();
    releases.push(() => release.resolve());
    let didAcquire = false;
    const done = track(
      client
        .$transaction(
          async (tx) => {
            const [session] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
            if (!session) throw new Error('Missing transaction PID');
            entered.resolve(session.pid);
            await acquire(tx, key);
            didAcquire = true;
            acquired.resolve();
            await bounded(release.promise, 'holder release', TRANSACTION_MS - 1_000);
            if (ending === 'rollback') throw ROLLBACK;
          },
          { maxWait: 5_000, timeout: TRANSACTION_MS },
        )
        .catch((error: unknown) => {
          if (ending !== 'rollback' || error !== ROLLBACK) throw error;
        }),
    );
    const beforeCompletion = <T>(promise: Promise<T>) =>
      bounded(
        Promise.race([
          promise,
          done.then(() => {
            throw new Error('Transaction ended before its barrier');
          }),
        ]),
        'transaction barrier',
      );
    return {
      entered: () => beforeCompletion(entered.promise),
      acquired: () => beforeCompletion(acquired.promise),
      didAcquire: () => didAcquire,
      release: () => release.resolve(),
      done,
    };
  }

  async function locks(key: Key) {
    const result = await observer.query<Lock>(
      `
      SELECT pid, granted, mode FROM pg_locks
      WHERE locktype = 'advisory' AND objsubid = 2
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND classid::bigint = (hashtext($1)::bigint & 4294967295)
        AND objid::bigint = (hashtext($2)::bigint & 4294967295)
      ORDER BY pid`,
      [key.namespace, key.value],
    );
    return result.rows;
  }

  return {
    get a() {
      return a;
    },
    get b() {
      return b;
    },
    async connect() {
      // Register before any await so partial setup is also owned by close().
      a = prisma();
      b = prisma();
      observer = new Client(config);
      disposals.push({ label: 'observer', close: () => observer.end() });
      observer.on('error', (error) => errors.push(error));
      await observer.connect();
      afterObserverConnected?.();
      await a.$connect();
      await b.$connect();
    },
    hold,
    locks,
    async tryLock(key: Key) {
      return transaction(b, async (tx) => {
        const [result] = await tx.$queryRaw<{ pid: number; acquired: boolean }[]>`
          SELECT pg_backend_pid() AS pid,
            pg_try_advisory_xact_lock(hashtext(${key.namespace}), hashtext(${key.value})) AS acquired`;
        if (!result) throw new Error('Missing try-lock result');
        return result;
      });
    },
    async distinctKeys(first: Key, second: Key) {
      const { rows } = await observer.query<{ distinct: boolean }>(
        `
        SELECT (hashtext($1), hashtext($2)) <> (hashtext($3), hashtext($4)) AS distinct`,
        [first.namespace, first.value, second.namespace, second.value],
      );
      expect(rows[0]?.distinct).toBe(true);
    },
    async waitForContention(
      key: Key,
      holderPid: number,
      waiterPid: number,
      waiter: ReturnType<typeof hold>,
    ) {
      const deadline = Date.now() + OBSERVATION_MS;
      while (Date.now() < deadline) {
        const observed = await locks(key);
        if (
          observed.some((lock) => lock.pid === holderPid && lock.granted) &&
          observed.some((lock) => lock.pid === waiterPid && !lock.granted)
        )
          return 'advisory-wait';
        if (waiter.didAcquire()) return 'acquired-without-wait';
        // Polling cadence only: success requires matching granted/waiting DB locks.
        await delay(10);
      }
      throw new Error('No keyed advisory wait or acquisition observed before deadline');
    },
    async close() {
      for (const release of releases) release();
      try {
        const outcomes = await bounded(
          Promise.allSettled(pending),
          'transactions cleanup',
          TRANSACTION_MS + 5_000,
        );
        for (const outcome of outcomes)
          if (outcome.status === 'rejected') errors.push(outcome.reason);
      } catch (error) {
        errors.push(error);
      }
      // Reverse order disconnects each client before its externally owned pool.
      for (const disposal of disposals.reverse()) {
        try {
          await bounded(disposal.close(), `${disposal.label} cleanup`);
        } catch (error) {
          errors.push(error);
        }
      }
      return errors;
    },
  };
}

const canonical: Acquire = async (tx, key) => {
  const rows = await tx.$queryRawTyped(acquireTransactionAdvisoryLock(key.namespace, key.value));
  expect(rows).toEqual([{ lockAcquired: 1 }]);
};

const rawControl: Acquire = async (tx, key) => {
  // pg control only: the assertions below also execute the real generated helper.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key.namespace}), hashtext(${key.value}))`;
};

async function expectNoOwnedSessions() {
  const config = connectionConfig();
  const audit = new Client({ ...config, application_name: 'knu_advisory_cleanup_audit' });
  try {
    await audit.connect();
    const { rows } = await audit.query<{ sessions: number; locks: number }>(
      `
      SELECT count(DISTINCT a.pid)::int AS sessions, count(l.pid)::int AS locks
      FROM pg_stat_activity a LEFT JOIN pg_locks l ON l.pid = a.pid AND l.locktype = 'advisory'
      WHERE a.application_name = $1`,
      [config.application_name],
    );
    expect(rows).toEqual([{ sessions: 0, locks: 0 }]);
  } finally {
    await bounded(audit.end(), 'cleanup audit disconnect');
  }
}

describe('transaction advisory lock execution', { timeout: TEST_MS }, () => {
  it('cleans registered resources when setup fails after the observer connects', async () => {
    const failure = new Error('injected partial setup failure');
    let bodyEntered = false;
    await expect(
      withSessions(
        () => {
          bodyEntered = true;
          return Promise.resolve();
        },
        () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);
    expect(bodyEntered).toBe(false);
    await expectNoOwnedSessions();
  });

  it('releases barriers and settles a blocked transaction when the test body fails', async () => {
    const failure = new Error('injected assertion-path failure');
    await expect(
      withSessions(async (sessions) => {
        const key = { namespace: `advisory-test:${RUN_ID}`, value: randomUUID() };
        const holder = sessions.hold(sessions.a, key, rawControl);
        const holderPid = await holder.entered();
        await holder.acquired();
        const waiter = sessions.hold(sessions.b, key, rawControl);
        const waiterPid = await waiter.entered();
        expect(waiterPid).not.toBe(holderPid);
        expect(await sessions.waitForContention(key, holderPid, waiterPid, waiter)).toBe(
          'advisory-wait',
        );
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expectNoOwnedSessions();
  });

  for (const [name, acquire] of [
    ['raw control', rawControl],
    ['canonical TypedSQL', canonical],
  ] as const) {
    for (const ending of ['commit', 'rollback'] as const) {
      it(`${name}: acquires/reenters, excludes same key, permits other keys, releases on ${ending}`, async () => {
        await withSessions(async (sessions) => {
          const key = { namespace: `advisory-test:${RUN_ID}`, value: randomUUID() };
          const other = { ...key, value: randomUUID() };
          await sessions.distinctKeys(key, other);
          const holder = sessions.hold(
            sessions.a,
            key,
            async (tx, heldKey) => {
              await acquire(tx, heldKey);
              await acquire(tx, heldKey); // Same-transaction reentrancy, not two-session exclusion.
            },
            ending,
          );
          const holderPid = await holder.entered();
          await holder.acquired();
          const sameKey = await sessions.tryLock(key);
          expect(sameKey.pid).not.toBe(holderPid);
          expect
            .soft(sameKey.acquired, 'independent same-key acquisition while holder tx is open')
            .toBe(false);
          expect
            .soft(await sessions.locks(key), 'actual lock state, not the returned success marker')
            .toEqual([{ pid: holderPid, granted: true, mode: 'ExclusiveLock' }]);
          const differentKey = await sessions.tryLock(other);
          expect(differentKey.pid).not.toBe(holderPid);
          expect(differentKey.acquired).toBe(true);
          holder.release();
          await holder.done;
          expect(await sessions.locks(key)).toEqual([]);
          const afterEnd = await sessions.tryLock(key);
          expect(afterEnd.pid).not.toBe(holderPid);
          expect(afterEnd.acquired).toBe(true);
          expect(await sessions.locks(key)).toEqual([]);
        });
      });
    }

    it(`${name}: an independent blocking acquisition waits on the advisory key until release`, async () => {
      await withSessions(async (sessions) => {
        const key = { namespace: `advisory-test:${RUN_ID}`, value: randomUUID() };
        const holder = sessions.hold(sessions.a, key, acquire);
        const holderPid = await holder.entered();
        await holder.acquired();
        const waiter = sessions.hold(sessions.b, key, acquire);
        const waiterPid = await waiter.entered();
        expect(waiterPid).not.toBe(holderPid);
        expect(await sessions.waitForContention(key, holderPid, waiterPid, waiter)).toBe(
          'advisory-wait',
        );
        holder.release();
        await holder.done;
        await waiter.acquired();
        expect(await sessions.locks(key)).toEqual([
          { pid: waiterPid, granted: true, mode: 'ExclusiveLock' },
        ]);
        waiter.release();
        await waiter.done;
        expect(await sessions.locks(key)).toEqual([]);
      });
    });
  }
});
