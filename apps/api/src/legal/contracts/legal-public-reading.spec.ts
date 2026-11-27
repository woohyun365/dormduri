import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import {
  PrismaService,
  RetentionDisclosurePrismaService,
  RetentionWorkerPrismaService,
} from '../../platform/database/prisma.service.js';
import { ApiExceptionFilter } from '../../platform/http/api-exception.filter.js';
import { createHttpAdapter } from '../../platform/http/http-adapter.js';
import { DOMAIN_METRICS_PORT } from '../../platform/observability/metrics/domain-metrics.port.js';
import observabilityConfig from '../../platform/observability/observability.config.js';
import { LegalModule } from '../legal.module.js';
import { LegalPublishedVersionReader } from '../queries/legal-published-version.reader.js';

type Kind =
  | 'TERMS_OF_SERVICE'
  | 'PRIVACY_POLICY'
  | 'PERSONAL_DATA_COLLECTION_USE_CONSENT'
  | 'AGE_14_OR_ABOVE_NOTICE';
type NoticeClass = 'HISTORICAL' | 'INITIAL' | 'GENERAL' | 'SIGNIFICANT';

interface VersionRow {
  id: string;
  kind: Kind;
  version: string;
  title: string;
  contentSchemaVersion: number;
  summaryItems: string[];
  sections: unknown[];
  changeSummary: string;
  noticeClass: NoticeClass;
  consentRequired: boolean;
  effectiveDate: Date;
  appliesUntil: Date | null;
  contentDigest: string;
  publishedAt: Date;
  withdrawnAt: Date | null;
  requestedByAccountId: string | null;
  approvedByAccountId: string | null;
  selfApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AcceptanceRow {
  id: string;
  userId: string;
  documentVersionId: string;
  kind: Kind;
  action: 'AGREE' | 'SHOW';
  source: string;
  acceptedAt: Date;
}

const ALL_KINDS: Kind[] = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'PERSONAL_DATA_COLLECTION_USE_CONSENT',
  'AGE_14_OR_ABOVE_NOTICE',
];
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

/** 00:00 KST of a calendar date. */
function kstMidnight(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - KST_OFFSET_MS);
}

/** A Prisma `@db.Date` value: the calendar date at UTC midnight. */
function dbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

const heading = (text: string) => ({ type: 'heading', level: 2, text });
const paragraph = (text: string) => ({ type: 'paragraph', text });

function row(
  kind: Kind,
  effectiveDate: string,
  noticeClass: NoticeClass,
  overrides: Partial<VersionRow> = {},
): VersionRow {
  const key = `${kind.toLowerCase()}-${effectiveDate}`;
  return {
    id: key,
    kind,
    version: key,
    title: `${kind} 문서`,
    contentSchemaVersion: 1,
    summaryItems: ['요약 항목'],
    sections: [heading('제1조(목적)'), paragraph(`${effectiveDate} 본문`)],
    changeSummary: `${effectiveDate} 판 변경 요약`,
    noticeClass,
    consentRequired: false,
    effectiveDate: dbDate(effectiveDate),
    appliesUntil: null,
    contentDigest: 'f'.repeat(64),
    publishedAt: kstMidnight(effectiveDate),
    withdrawnAt: null,
    requestedByAccountId: 'author-admin',
    approvedByAccountId: 'approver-admin',
    selfApproved: false,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  };
}

function baseRows(): VersionRow[] {
  return [
    row('TERMS_OF_SERVICE', '2026-06-22', 'INITIAL'),
    row('PRIVACY_POLICY', '2026-06-22', 'HISTORICAL', {
      id: 'privacy-policy-historical-2026-06-22',
      appliesUntil: dbDate('2026-11-19'),
      sections: [heading('제1조(목적)'), paragraph('옛 본문'), heading('제2조(보유기간)')],
    }),
    row('PRIVACY_POLICY', '2026-11-20', 'INITIAL', {
      id: 'privacy-policy-2026-06-22',
      sections: [heading('제1조(목적)'), paragraph('새 본문'), heading('제3조(파기)')],
    }),
    row('PERSONAL_DATA_COLLECTION_USE_CONSENT', '2026-06-22', 'INITIAL'),
    row('AGE_14_OR_ABOVE_NOTICE', '2026-06-22', 'INITIAL'),
  ];
}

function createFakeDatabase(versions: VersionRow[], acceptances: AcceptanceRow[] = []) {
  const state = {
    now: new Date('2026-11-26T03:00:00.000Z'),
    failing: false,
    /** Fails only the published version read (after the database time), with this error. */
    versionReadFailure: null as Error | null,
  };
  function guard() {
    if (state.failing) {
      throw new Error('connect ECONNREFUSED database');
    }
  }
  const legalDocumentVersion = {
    findMany: vi.fn(
      (args: {
        where?: {
          kind?: Kind | { in: Kind[] };
          withdrawnAt?: null;
          publishedAt?: { lte?: Date };
        };
      }) => {
        guard();
        if (state.versionReadFailure) {
          return Promise.reject(state.versionReadFailure);
        }
        const where = args.where ?? {};
        return Promise.resolve(
          versions.filter((candidate) => {
            if (typeof where.kind === 'string' && candidate.kind !== where.kind) return false;
            if (typeof where.kind === 'object' && !where.kind.in.includes(candidate.kind)) {
              return false;
            }
            if (where.withdrawnAt === null && candidate.withdrawnAt !== null) return false;
            const lte = where.publishedAt?.lte;
            return !(lte && candidate.publishedAt.getTime() > lte.getTime());
          }),
        );
      },
    ),
  };
  const legalAcceptanceRecord = {
    findMany: vi.fn((args: { where?: { userId?: string; action?: string } }) => {
      guard();
      return Promise.resolve(
        acceptances.filter(
          (record) =>
            (args.where?.userId === undefined || record.userId === args.where.userId) &&
            (args.where?.action === undefined || record.action === args.where.action),
        ),
      );
    }),
    createMany: vi.fn((args: { data: Omit<AcceptanceRow, 'id' | 'acceptedAt'>[] }) => {
      guard();
      for (const data of args.data) {
        acceptances.push({
          id: `record-${acceptances.length + 1}`,
          acceptedAt: state.now,
          ...data,
        });
      }
      return Promise.resolve({ count: args.data.length });
    }),
  };
  const prisma = {
    getDatabaseNow: vi.fn(() => {
      guard();
      return Promise.resolve(state.now);
    }),
    legalDocumentVersion,
    legalAcceptanceRecord,
    runSerializableTransaction: vi.fn((work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };
  return { prisma, state, acceptances };
}

const actor = {
  id: 'user-1',
  actorId: 'user-1',
  actorType: 'USER' as const,
  sessionId: 'session-1',
  campus: 'CHUNCHEON' as const,
  gender: 'M' as const,
  capabilities: [],
};

const apps: INestApplication[] = [];

async function createApp(database: ReturnType<typeof createFakeDatabase>) {
  const resolver = {
    resolveCurrentUserContext: vi.fn((token: string) => {
      if (token !== 'user-token') {
        throw new UnauthorizedException();
      }
      return Promise.resolve(actor);
    }),
  };
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, load: [observabilityConfig] }),
      LegalModule,
    ],
    providers: [
      AuthenticatedUserGuard,
      Reflector,
      { provide: AuthActorContextResolver, useValue: resolver },
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(database.prisma)
    .overrideProvider(RetentionWorkerPrismaService)
    .useValue({})
    .overrideProvider(RetentionDisclosurePrismaService)
    .useValue({})
    .compile();
  const app = module.createNestApplication(createHttpAdapter(false), { logger: false });
  app.useGlobalGuards(module.get(AuthenticatedUserGuard));
  app.useGlobalFilters(
    new ApiExceptionFilter(
      { write: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn() } as never,
      { recordException: vi.fn() } as never,
      module.get(HttpAdapterHost),
    ),
  );
  await app.init();
  apps.push(app);
  return app;
}

function http(app: INestApplication) {
  return request(app.getHttpServer() as Parameters<typeof request>[0]);
}

interface SummaryBody {
  versionKey: string;
  status: string;
  appliesFrom: string;
  appliesUntil: string | null;
  changeSummary: string;
  consentRequired: boolean;
}

interface DocumentBody {
  id: string;
  version: string;
  effectiveAt: string;
  lastModifiedAt: string;
  sections: unknown[];
}

interface PageBody {
  kind: string;
  viewing: DocumentBody & SummaryBody;
  versions: SummaryBody[];
  scheduled: SummaryBody | null;
}

interface ComparisonBody {
  kind: string;
  versionKey: string;
  previousVersionKey: string | null;
  articles: Array<{ heading: string | null; change: string }>;
}

interface PendingBody {
  pending: Array<{ kind: string; document: DocumentBody }>;
}

type BundleBody = Record<string, DocumentBody>;

const pageOf = (response: request.Response) => response.body as PageBody;
const documentOf = (response: request.Response) => response.body as DocumentBody;
const bundleOf = (response: request.Response) => response.body as BundleBody;
const comparisonOf = (response: request.Response) => response.body as ComparisonBody;
const pendingOf = (response: request.Response) => response.body as PendingBody;
const errorCodeOf = (response: request.Response) => (response.body as { code?: string }).code;

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('legal public reading API', () => {
  it('판 열람은 version이 없으면 시행 중 판을, 있으면 그 시행일 판을 내고 판 목록은 최신이 앞이다', async () => {
    const app = await createApp(createFakeDatabase(baseRows()));

    const current = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(current.status).toBe(200);
    expect(pageOf(current).kind).toBe('PRIVACY_POLICY');
    expect(pageOf(current).viewing).toMatchObject({
      versionKey: '2026-11-20',
      status: 'current',
      appliesFrom: '2026-11-20',
      appliesUntil: null,
      effectiveAt: '2026-11-20T00:00:00.000Z',
      lastModifiedAt: '2026-11-20T00:00:00.000Z',
    });
    expect(
      pageOf(current).versions.map((entry) => [
        entry.versionKey,
        entry.status,
        entry.appliesFrom,
        entry.appliesUntil,
      ]),
    ).toEqual([
      ['2026-11-20', 'current', '2026-11-20', null],
      ['2026-06-22', 'previous', '2026-06-22', '2026-11-19'],
    ]);
    expect(pageOf(current).scheduled).toBeNull();

    const previous = await http(app).get(
      '/api/legal/documents/PRIVACY_POLICY/page?version=2026-06-22',
    );
    expect(previous.status).toBe(200);
    expect(pageOf(previous).viewing).toMatchObject({
      versionKey: '2026-06-22',
      status: 'previous',
      appliesUntil: '2026-11-19',
    });
    expect(pageOf(previous).viewing.sections).toContainEqual(paragraph('옛 본문'));
  });

  it('없는 판·형식이 틀린 판·철회한 판 주소는 404 LEGAL_DOCUMENT_VERSION_NOT_FOUND다', async () => {
    const rows = baseRows().concat(
      row('PRIVACY_POLICY', '2026-12-28', 'GENERAL', {
        publishedAt: new Date('2026-11-20T00:00:00.000Z'),
        withdrawnAt: new Date('2026-11-21T00:00:00.000Z'),
      }),
    );
    const app = await createApp(createFakeDatabase(rows));

    for (const version of ['2026-07-01', '2026-13-40', '2026-02-30', 'latest', '2026-12-28']) {
      const response = await http(app).get(
        `/api/legal/documents/PRIVACY_POLICY/page?version=${encodeURIComponent(version)}`,
      );
      expect(response.status, version).toBe(404);
      expect(errorCodeOf(response), version).toBe('LEGAL_DOCUMENT_VERSION_NOT_FOUND');
    }
  });

  it('시행 예정 판은 DB 시각이 시행 시각 1초 전이면 고르지 않고 시행 시각이면 고르며, 시행 중 판의 적용 끝은 그 전날이다', async () => {
    const database = createFakeDatabase(
      baseRows().concat(
        row('PRIVACY_POLICY', '2026-12-01', 'GENERAL', {
          publishedAt: new Date('2026-11-23T03:00:00.000Z'),
        }),
      ),
    );
    const app = await createApp(database);

    database.state.now = new Date(kstMidnight('2026-12-01').getTime() - 1_000);
    const before = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(before.status).toBe(200);
    expect(pageOf(before).viewing.versionKey).toBe('2026-11-20');
    expect(pageOf(before).viewing.appliesUntil).toBe('2026-11-30');
    expect(pageOf(before).scheduled).toMatchObject({
      versionKey: '2026-12-01',
      status: 'scheduled',
      appliesFrom: '2026-12-01',
      appliesUntil: null,
    });
    const activeBefore = await http(app).get('/api/legal/documents/PRIVACY_POLICY/active');
    expect(documentOf(activeBefore).effectiveAt).toBe('2026-11-20T00:00:00.000Z');

    database.state.now = kstMidnight('2026-12-01');
    const after = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(pageOf(after).viewing.versionKey).toBe('2026-12-01');
    expect(pageOf(after).scheduled).toBeNull();
    const activeAfter = await http(app).get('/api/legal/documents/PRIVACY_POLICY/active');
    expect(documentOf(activeAfter).effectiveAt).toBe('2026-12-01T00:00:00.000Z');
  });

  it('DB 읽기가 실패하면 마지막 묶음으로 답하고 현재 시각은 마지막 DB 시각에 monotonic 경과를 더하며, 묶음이 없으면 503이다', async () => {
    let monotonicMs = 1_000_000;
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicMs);
    const database = createFakeDatabase(
      baseRows().concat(
        row('PRIVACY_POLICY', '2026-12-01', 'GENERAL', {
          publishedAt: new Date('2026-11-23T03:00:00.000Z'),
        }),
      ),
    );
    database.state.now = new Date(kstMidnight('2026-12-01').getTime() - 60_000);
    const app = await createApp(database);

    const warm = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(warm.status).toBe(200);
    expect(pageOf(warm).viewing.versionKey).toBe('2026-11-20');

    database.state.failing = true;
    monotonicMs += 30_000;
    const stillBefore = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(stillBefore.status).toBe(200);
    expect(pageOf(stillBefore).viewing.versionKey).toBe('2026-11-20');

    monotonicMs += 30_000;
    const atEffective = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(atEffective.status).toBe(200);
    expect(pageOf(atEffective).viewing.versionKey).toBe('2026-12-01');

    const coldDatabase = createFakeDatabase(baseRows());
    coldDatabase.state.failing = true;
    const coldApp = await createApp(coldDatabase);
    const cold = await http(coldApp).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(cold.status).toBe(503);
    expect(errorCodeOf(cold)).toBe('LEGAL_DOCUMENTS_UNAVAILABLE');
  });

  it('DB 읽기 실패는 단계·kind·오류 종류와 code·대체 결과를 log에 남기고 driver 메시지는 남기지 않는다', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const database = createFakeDatabase(baseRows());
    const app = await createApp(database);
    const readerWarnings = () =>
      warn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.startsWith('[LegalPublishedVersionReader]'));

    database.state.versionReadFailure = Object.assign(
      new Error('permission denied for table LegalDocumentVersion: secret-query-value'),
      { code: '42501' },
    );
    const cold = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(cold.status).toBe(503);
    expect(readerWarnings()).toEqual([
      '[LegalPublishedVersionReader] database read failed endpoint=page step=published_versions kinds=PRIVACY_POLICY errorType=Error errorCode=42501 fallback=unavailable',
    ]);

    database.state.versionReadFailure = null;
    expect((await http(app).get('/api/legal/documents/PRIVACY_POLICY/page')).status).toBe(200);
    database.state.failing = true;
    const memory = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(memory.status).toBe(200);
    expect(readerWarnings().at(-1)).toBe(
      '[LegalPublishedVersionReader] database read failed endpoint=page step=database_time kinds=PRIVACY_POLICY errorType=Error errorCode=none fallback=memory',
    );
    expect(readerWarnings().join('\n')).not.toMatch(/secret-query-value|ECONNREFUSED/u);
  });

  it('읽는 법이 없는 본문 형식 version은 판으로 바꾸지 않고 행 단계 실패로 남긴다', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const rows = baseRows().map((candidate) =>
      candidate.kind === 'PRIVACY_POLICY' ? { ...candidate, contentSchemaVersion: 2 } : candidate,
    );
    const app = await createApp(createFakeDatabase(rows));

    const response = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(response.status).toBe(503);
    expect(errorCodeOf(response)).toBe('LEGAL_DOCUMENTS_UNAVAILABLE');
    expect(warn.mock.calls.map(([message]) => String(message))).toContainEqual(
      '[LegalPublishedVersionReader] database read failed endpoint=page step=version_rows kinds=PRIVACY_POLICY errorType=Error errorCode=none fallback=unavailable',
    );
    expect((await http(app).get('/api/legal/documents/TERMS_OF_SERVICE/page')).status).toBe(200);
  });

  it('먼저 시작해 늦게 끝난 DB 읽기는 더 새 DB 시각의 묶음을 memory에서 덮지 않는다', async () => {
    const older = new Date('2026-11-26T03:00:00.000Z');
    const newer = new Date('2026-11-26T03:00:05.000Z');
    const privacyRows = baseRows().filter((candidate) => candidate.kind === 'PRIVACY_POLICY');
    const newerRows = privacyRows.concat(
      row('PRIVACY_POLICY', '2026-12-01', 'GENERAL', {
        publishedAt: new Date('2026-11-26T03:00:02.000Z'),
      }),
    );
    let releaseOlder: (() => void) | undefined;
    const repository = {
      getDatabaseNow: vi
        .fn<() => Promise<Date>>()
        .mockResolvedValueOnce(older)
        .mockResolvedValueOnce(newer)
        .mockRejectedValue(new Error('connect ECONNREFUSED database')),
      listPublishedVersions: vi.fn((_kinds: unknown, now: Date) =>
        now === older
          ? new Promise<VersionRow[]>((resolve) => {
              releaseOlder = () => resolve(privacyRows);
            })
          : Promise.resolve(newerRows),
      ),
    };
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const reader = new LegalPublishedVersionReader(
      repository as never,
      { incrementCounter: vi.fn() } as never,
    );

    const first = reader.read(['PRIVACY_POLICY'], 'page');
    await vi.waitFor(() => expect(releaseOlder).toBeDefined());
    const second = await reader.read(['PRIVACY_POLICY'], 'page');
    expect(second.versionsOf('PRIVACY_POLICY')).toHaveLength(3);
    releaseOlder?.();
    expect((await first).versionsOf('PRIVACY_POLICY')).toHaveLength(2);

    const fromMemory = await reader.read(['PRIVACY_POLICY'], 'page');
    expect(fromMemory.source).toBe('memory');
    expect(
      fromMemory.versionsOf('PRIVACY_POLICY').map((version) => version.effectiveDate),
    ).toContain('2026-12-01');
    expect(fromMemory.nowOf('PRIVACY_POLICY').getTime()).toBeGreaterThanOrEqual(newer.getTime());
  });

  // The database read has a time limit shorter than the Web request timeout (3 s), so a database
  // that stops answering is answered from memory before the Web gives up.
  it('DB 읽기가 1.5초 상한을 넘으면 memory 묶음으로 답하고 그 단계를 log에 남긴다', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const privacyRows = baseRows().filter((candidate) => candidate.kind === 'PRIVACY_POLICY');
    const databaseNow = new Date('2026-11-26T03:00:00.000Z');
    const repository = {
      getDatabaseNow: vi
        .fn<() => Promise<Date>>()
        .mockResolvedValueOnce(databaseNow)
        .mockImplementation(() => new Promise<Date>(() => undefined)),
      listPublishedVersions: vi.fn(() => Promise.resolve(privacyRows)),
    };
    const reader = new LegalPublishedVersionReader(
      repository as never,
      { incrementCounter: vi.fn() } as never,
    );
    expect((await reader.read(['PRIVACY_POLICY'], 'page')).source).toBe('database');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let answered: Awaited<ReturnType<typeof reader.read>> | undefined;
    try {
      void reader.read(['PRIVACY_POLICY'], 'page').then((read) => {
        answered = read;
      });
      await vi.advanceTimersByTimeAsync(1_499);
      expect(answered).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
    } finally {
      vi.useRealTimers();
    }

    expect(answered?.source).toBe('memory');
    expect(answered?.versionsOf('PRIVACY_POLICY')).toHaveLength(2);
    expect(warn.mock.calls.map(([message]) => String(message))).toContainEqual(
      '[LegalPublishedVersionReader] database read failed endpoint=page step=database_time kinds=PRIVACY_POLICY errorType=LegalDatabaseReadTimeout errorCode=none fallback=memory',
    );
  });

  it('읽기마다 endpoint·출처·결과 metric을 남긴다', async () => {
    const database = createFakeDatabase(baseRows());
    const app = await createApp(database);
    const metrics = app.get<{ incrementCounter: (input: unknown) => void }>(DOMAIN_METRICS_PORT);
    const increment = vi.spyOn(metrics, 'incrementCounter');

    await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    database.state.failing = true;
    await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    await http(app).get('/api/legal/documents/PRIVACY_POLICY/page?version=2026-07-01');

    const reads = increment.mock.calls
      .map(([input]) => input as { name: string; labels?: Record<string, string> })
      .filter((input) => input.name === 'api_legal_document_reads_total')
      .map((input) => input.labels);
    expect(reads).toEqual([
      { endpoint: 'page', source: 'database', outcome: 'ok' },
      { endpoint: 'page', source: 'memory', outcome: 'ok' },
      { endpoint: 'page', source: 'memory', outcome: 'not_found' },
    ]);
  });

  it('옛 두 endpoint는 응답 key·id·version을 그대로 두고 날짜는 KST 시행일의 T00:00:00.000Z다', async () => {
    const app = await createApp(createFakeDatabase(baseRows()));

    const active = await http(app).get('/api/legal/documents/PRIVACY_POLICY/active');
    expect(active.status).toBe(200);
    expect(Object.keys(documentOf(active)).sort()).toEqual(
      [
        'changeSummary',
        'effectiveAt',
        'id',
        'kind',
        'lastModifiedAt',
        'sections',
        'summaryItems',
        'title',
        'version',
      ].sort(),
    );
    expect(documentOf(active)).toMatchObject({
      id: 'privacy-policy-2026-06-22',
      version: 'privacy_policy-2026-11-20',
      effectiveAt: '2026-11-20T00:00:00.000Z',
      lastModifiedAt: '2026-11-20T00:00:00.000Z',
    });

    const bundle = await http(app).get('/api/legal/documents/active-bundle');
    expect(bundle.status).toBe(200);
    expect(Object.keys(bundleOf(bundle)).sort()).toEqual(
      [
        'age14OrAboveNotice',
        'personalDataCollectionUseConsent',
        'privacyPolicy',
        'termsOfService',
      ].sort(),
    );
    expect(bundleOf(bundle).privacyPolicy?.id).toBe('privacy-policy-2026-06-22');
    expect(bundleOf(bundle).termsOfService?.effectiveAt.slice(0, 10)).toBe('2026-06-22');
  });

  it('최종 수정일은 철회 UPDATE가 updatedAt을 바꿔도 첫 게시는 시행일, 일반 판은 승인일 그대로다', async () => {
    const touched = new Date('2026-11-25T08:00:00.000Z');
    const rows = [
      row('TERMS_OF_SERVICE', '2026-06-22', 'INITIAL', { updatedAt: touched }),
      row('TERMS_OF_SERVICE', '2026-11-25', 'GENERAL', {
        // 2026-11-17T16:30Z is 2026-11-18 01:30 KST.
        publishedAt: new Date('2026-11-17T16:30:00.000Z'),
        updatedAt: touched,
      }),
      row('TERMS_OF_SERVICE', '2026-12-30', 'GENERAL', {
        publishedAt: new Date('2026-11-20T00:00:00.000Z'),
        withdrawnAt: touched,
        updatedAt: touched,
      }),
    ].concat(baseRows().filter((candidate) => candidate.kind !== 'TERMS_OF_SERVICE'));
    const app = await createApp(createFakeDatabase(rows));

    const active = await http(app).get('/api/legal/documents/TERMS_OF_SERVICE/active');
    expect(documentOf(active).lastModifiedAt).toBe('2026-11-18T00:00:00.000Z');
    const first = await http(app).get(
      '/api/legal/documents/TERMS_OF_SERVICE/page?version=2026-06-22',
    );
    expect(pageOf(first).viewing.lastModifiedAt).toBe('2026-06-22T00:00:00.000Z');
  });

  it('조항 대조표는 바로 앞 판(철회 제외)과 비교하고 첫 판은 빈 목록이다', async () => {
    const app = await createApp(createFakeDatabase(baseRows()));

    const comparison = await http(app).get(
      '/api/legal/documents/PRIVACY_POLICY/versions/2026-11-20/comparison',
    );
    expect(comparison.status).toBe(200);
    expect(comparisonOf(comparison)).toMatchObject({
      kind: 'PRIVACY_POLICY',
      versionKey: '2026-11-20',
      previousVersionKey: '2026-06-22',
    });
    expect(
      comparisonOf(comparison).articles.map((article: Record<string, unknown>) => [
        article.heading,
        article.change,
      ]),
    ).toEqual([
      ['제1조(목적)', 'changed'],
      ['제2조(보유기간)', 'removed'],
      ['제3조(파기)', 'added'],
    ]);

    const first = await http(app).get(
      '/api/legal/documents/PRIVACY_POLICY/versions/2026-06-22/comparison',
    );
    expect(first.status).toBe(200);
    expect(comparisonOf(first)).toMatchObject({ previousVersionKey: null, articles: [] });

    const missing = await http(app).get(
      '/api/legal/documents/PRIVACY_POLICY/versions/2026-07-01/comparison',
    );
    expect(missing.status).toBe(404);
    expect(errorCodeOf(missing)).toBe('LEGAL_DOCUMENT_VERSION_NOT_FOUND');
  });

  it('개정 예고는 kind별 시행 예정 판 요약이다', async () => {
    const app = await createApp(
      createFakeDatabase(
        baseRows().concat(
          row('PRIVACY_POLICY', '2026-12-04', 'GENERAL', {
            publishedAt: new Date('2026-11-26T01:00:00.000Z'),
          }),
        ),
      ),
    );

    const notices = await http(app).get('/api/legal/revision-notices');
    expect(notices.status).toBe(200);
    expect(notices.body as unknown).toEqual({
      notices: [
        {
          kind: 'PRIVACY_POLICY',
          versionKey: '2026-12-04',
          status: 'scheduled',
          appliesFrom: '2026-12-04',
          appliesUntil: null,
          changeSummary: '2026-12-04 판 변경 요약',
          consentRequired: false,
        },
      ],
    });
  });

  it('공개 응답에는 digest·작성자·승인자·고지 등급·철회 시각이 없다', async () => {
    const app = await createApp(createFakeDatabase(baseRows()));

    const page = await http(app).get('/api/legal/documents/PRIVACY_POLICY/page');
    expect(page.status).toBe(200);
    const text = JSON.stringify(pageOf(page));
    for (const internal of [
      'contentDigest',
      'requestedByAccountId',
      'approvedByAccountId',
      'author-admin',
      'selfApproved',
      'noticeClass',
      'HISTORICAL',
      'withdrawnAt',
      'publishedAt',
    ]) {
      expect(text, internal).not.toContain(internal);
    }
  });
});

describe('legal reconsent API', () => {
  function termsRows(): VersionRow[] {
    return [
      row('TERMS_OF_SERVICE', '2026-06-22', 'INITIAL'),
      row('TERMS_OF_SERVICE', '2026-12-01', 'SIGNIFICANT', {
        consentRequired: true,
        publishedAt: new Date('2026-10-30T00:00:00.000Z'),
      }),
    ].concat(baseRows().filter((candidate) => candidate.kind !== 'TERMS_OF_SERVICE'));
  }

  function signupRecords(userId = actor.id): AcceptanceRow[] {
    return ALL_KINDS.map((kind, index) => ({
      id: `signup-${index}`,
      userId,
      kind,
      documentVersionId:
        kind === 'PRIVACY_POLICY'
          ? 'privacy-policy-2026-06-22'
          : `${kind.toLowerCase()}-2026-06-22`,
      action: kind === 'PRIVACY_POLICY' ? 'SHOW' : 'AGREE',
      source: 'SIGNUP',
      acceptedAt: new Date('2026-07-01T00:00:00.000Z'),
    }));
  }

  it('재동의 route는 인증 없이 401이다', async () => {
    const app = await createApp(createFakeDatabase(termsRows(), signupRecords()));

    expect((await http(app).get('/api/legal/consents/pending')).status).toBe(401);
    expect(
      (
        await http(app)
          .post('/api/legal/consents')
          .send({ documentVersionIds: ['x'] })
      ).status,
    ).toBe(401);
  });

  it('재동의 필요 판이 시행되면 그 kind가 대기에 오르고, 시행 중 판 id로 기록하면 빠지며 옛 판 id는 거부한다', async () => {
    const database = createFakeDatabase(termsRows(), signupRecords());
    database.state.now = new Date(kstMidnight('2026-12-01').getTime() + 60_000);
    const app = await createApp(database);
    const auth = { Authorization: 'Bearer user-token' };

    const pending = await http(app).get('/api/legal/consents/pending').set(auth);
    expect(pending.status).toBe(200);
    expect(
      pendingOf(pending).pending.map((entry: { kind: string; document: { id: string } }) => [
        entry.kind,
        entry.document.id,
      ]),
    ).toEqual([['TERMS_OF_SERVICE', 'terms_of_service-2026-12-01']]);

    const stale = await http(app)
      .post('/api/legal/consents')
      .set(auth)
      .send({ documentVersionIds: ['terms_of_service-2026-06-22'] });
    expect(stale.status).toBe(409);
    expect(errorCodeOf(stale)).toBe('LEGAL_CONSENT_STALE');

    const notPending = await http(app)
      .post('/api/legal/consents')
      .set(auth)
      .send({ documentVersionIds: ['age_14_or_above_notice-2026-06-22'] });
    expect(notPending.status).toBe(409);
    expect(errorCodeOf(notPending)).toBe('LEGAL_CONSENT_STALE');

    const recorded = await http(app)
      .post('/api/legal/consents')
      .set(auth)
      .send({ documentVersionIds: ['terms_of_service-2026-12-01'] });
    expect(recorded.status).toBe(201);
    expect(pendingOf(recorded)).toEqual({ pending: [] });
    expect(database.acceptances.at(-1)).toMatchObject({
      userId: actor.id,
      kind: 'TERMS_OF_SERVICE',
      documentVersionId: 'terms_of_service-2026-12-01',
      action: 'AGREE',
      source: 'RECONSENT',
    });
  });

  it('재동의 필요 판 시행 전에는 대기가 없다', async () => {
    const database = createFakeDatabase(termsRows(), signupRecords());
    database.state.now = new Date(kstMidnight('2026-12-01').getTime() - 1_000);
    const app = await createApp(database);

    const pending = await http(app)
      .get('/api/legal/consents/pending')
      .set({ Authorization: 'Bearer user-token' });
    expect(pending.status).toBe(200);
    expect(pendingOf(pending)).toEqual({ pending: [] });
  });

  it('재동의 필요 판 R 뒤에 재동의 불요 판이 시행돼도 R 기간에 동의하지 않은 회원은 대기에 남고 시행 중 판으로 기록된다', async () => {
    const rows = termsRows().concat(
      row('TERMS_OF_SERVICE', '2027-01-04', 'GENERAL', {
        publishedAt: new Date('2026-12-20T00:00:00.000Z'),
      }),
    );
    const database = createFakeDatabase(rows, signupRecords());
    database.state.now = new Date(kstMidnight('2027-01-04').getTime() + 60_000);
    const app = await createApp(database);
    const auth = { Authorization: 'Bearer user-token' };

    const pending = await http(app).get('/api/legal/consents/pending').set(auth);
    expect(pending.status).toBe(200);
    expect(
      pendingOf(pending).pending.map((entry: { kind: string; document: { id: string } }) => [
        entry.kind,
        entry.document.id,
      ]),
    ).toEqual([['TERMS_OF_SERVICE', 'terms_of_service-2027-01-04']]);

    const recorded = await http(app)
      .post('/api/legal/consents')
      .set(auth)
      .send({ documentVersionIds: ['terms_of_service-2027-01-04'] });
    expect(recorded.status).toBe(201);
    expect(pendingOf(recorded)).toEqual({ pending: [] });

    // A member who agreed during R's period is not pending once the later version is in effect.
    const agreedDuringR = createFakeDatabase(
      rows,
      signupRecords().concat({
        id: 'reconsent-r',
        userId: actor.id,
        kind: 'TERMS_OF_SERVICE',
        documentVersionId: 'terms_of_service-2026-12-01',
        action: 'AGREE',
        source: 'RECONSENT',
        acceptedAt: new Date('2026-12-02T00:00:00.000Z'),
      }),
    );
    agreedDuringR.state.now = database.state.now;
    const otherApp = await createApp(agreedDuringR);
    const none = await http(otherApp).get('/api/legal/consents/pending').set(auth);
    expect(pendingOf(none)).toEqual({ pending: [] });
  });
});
