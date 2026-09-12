import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';

export function createRuntimeSecrets() {
  const randomSecret = () => randomBytes(32).toString('hex');
  const randomBase64Secret = () => randomBytes(32).toString('base64');

  return {
    migrationPassword: randomSecret(),
    runtimePassword: randomSecret(),
    retentionPassword: randomSecret(),
    disclosurePassword: randomSecret(),
    logHash: randomSecret(),
    metricsToken: randomSecret(),
    verificationHmac: randomSecret(),
    authPersistenceHmac: randomSecret(),
    authMailEnvelope: randomBase64Secret(),
    retentionIdentity: randomBase64Secret(),
    retentionVault: randomBase64Secret(),
    roommateCursor: randomSecret(),
    profileEntry: randomSecret(),
    chatCursor: randomSecret(),
    grafanaPassword: randomSecret(),
  };
}

export async function allocateLoopbackPorts(names) {
  const values = await Promise.all(names.map(() => freePort()));
  return Object.fromEntries(names.map((name, index) => [name, values[index]]));
}

export function resolveDatabaseUrls({ databaseMode, ports, secrets, environment, assert }) {
  if (databaseMode === 'external') {
    assert(
      environment.FULL_STACK_REHEARSAL_EXTERNAL_DB_CLASSIFICATION === 'disposable-test',
      'External database requires disposable-test classification.',
    );
    assert(
      environment.FULL_STACK_REHEARSAL_EXTERNAL_DB_APPROVAL === 'I_ACKNOWLEDGE_DESTRUCTIVE_TEST_DB',
      'External database requires explicit destructive-test approval.',
    );
    const keys = {
      migration: 'FULL_STACK_REHEARSAL_EXTERNAL_MIGRATION_DATABASE_URL',
      runtime: 'FULL_STACK_REHEARSAL_EXTERNAL_RUNTIME_DATABASE_URL',
      retention: 'FULL_STACK_REHEARSAL_EXTERNAL_RETENTION_DATABASE_URL',
      disclosure: 'FULL_STACK_REHEARSAL_EXTERNAL_DISCLOSURE_DATABASE_URL',
    };
    const values = Object.fromEntries(
      Object.entries(keys).map(([name, key]) => {
        const value = environment[key]?.trim();
        assert(value, `Missing external database input: ${key}`);
        assert(!/prod(?:uction)?/iu.test(value), `${key} looks like a production database.`);
        return [name, value];
      }),
    );
    return { host: values, container: values };
  }

  assert(databaseMode === 'local', `Unsupported database mode: ${databaseMode}`);
  const database = 'knu_roommate_rehearsal';
  const host = `127.0.0.1:${ports.postgres}`;
  const container = 'postgres:5432';
  return {
    host: databaseRoles(host, database, secrets),
    container: databaseRoles(container, database, secrets),
  };
}

export function writeApiRuntimeInputs({ runtimeEnvPath, metricsTokenPath, urls, secrets }) {
  const lines = [
    'NODE_ENV=production',
    'PORT=4000',
    'TZ=Asia/Seoul',
    `DATABASE_URL=${urls.container.runtime}`,
    `DIRECT_URL=${urls.container.migration}`,
    `MIGRATION_DATABASE_URL=${urls.container.migration}`,
    `RETENTION_WORKER_DATABASE_URL=${urls.container.retention}`,
    `RETENTION_DISCLOSURE_DATABASE_URL=${urls.container.disclosure}`,
    'DATABASE_POOL_MAX=5',
    'DATABASE_POOL_MIN=0',
    'DATABASE_ADAPTER_CONNECT_TIMEOUT_MS=5000',
    'DATABASE_ADAPTER_IDLE_TIMEOUT_MS=300000',
    `LOG_HASH_SECRET=${secrets.logHash}`,
    `RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=${secrets.retentionIdentity}`,
    'RETENTION_IDENTITY_KEY_VERSION=v1',
    `RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=${secrets.retentionVault}`,
    'RETENTION_VAULT_CHAT_BODY_KEY_VERSION=v1',
    'METRICS_ENABLED=true',
    `METRICS_BEARER_TOKEN=${secrets.metricsToken}`,
    `VERIFICATION_CODE_HMAC_SECRET=${secrets.verificationHmac}`,
    `AUTH_PERSISTENCE_HMAC_SECRET=${secrets.authPersistenceHmac}`,
    'AUTH_PERSISTENCE_HMAC_KEY_VERSION=v1',
    `AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64=${secrets.authMailEnvelope}`,
    'AUTH_MAIL_ENVELOPE_KEY_VERSION=v1',
    'AUTH_MAIL_DISPATCHER_ENABLED=false',
    'AUTH_PASSWORD_HASH_CONCURRENCY=2',
    'AUTH_PASSWORD_HASH_QUEUE_LIMIT=16',
    'AUTH_PASSWORD_HASH_WAIT_TIMEOUT_MS=2000',
    'EMAIL_PROVIDER=ses',
    'SES_REGION=ap-northeast-2',
    'SES_FROM_EMAIL=no-reply@rehearsal.invalid',
    `ROOMMATE_SEARCH_CURSOR_HMAC_SECRET=${secrets.roommateCursor}`,
    `PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET=${secrets.profileEntry}`,
    `CHAT_THREAD_LIST_CURSOR_HMAC_SECRET=${secrets.chatCursor}`,
    'HTTP_TRUST_PROXY_HOPS=1',
    'HTTP_CORS_ALLOWED_ORIGINS=http://127.0.0.1',
    'CHAT_REALTIME_ALLOWED_ORIGINS=http://127.0.0.1',
    'CHAT_REALTIME_TRUST_PROXY=true',
    'LIFECYCLE_SWEEP_ENABLED=false',
    'LOG_LEVEL=info',
    'LOG_PRETTY=false',
    'OBSERVABILITY_SERVICE_NAME=api',
    '',
  ];
  writeFileSync(runtimeEnvPath, lines.join('\n'), { mode: 0o600 });
  writeFileSync(metricsTokenPath, `${secrets.metricsToken}\n`, { mode: 0o600 });
}

function databaseRoles(host, database, secrets) {
  return {
    migration: databaseUrl('rehearsal_migration', secrets.migrationPassword, host, database),
    runtime: databaseUrl('rehearsal_runtime', secrets.runtimePassword, host, database),
    retention: databaseUrl('rehearsal_retention', secrets.retentionPassword, host, database),
    disclosure: databaseUrl('rehearsal_disclosure', secrets.disclosurePassword, host, database),
  };
}

function databaseUrl(user, password, host, database) {
  return `postgresql://${user}:${password}@${host}/${database}?schema=public`;
}

async function freePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port === null) reject(new Error('Failed to allocate a loopback port.'));
        else resolvePromise(port);
      });
    });
  });
}
