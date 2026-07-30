import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(CURRENT_DIR, '../../..');
const SCHEMA_PATH = path.join(API_ROOT, 'prisma/schema.prisma');
const BASELINE_PATH = path.join(
  API_ROOT,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);
function readApiFile(relativePath: string): string {
  return readFileSync(path.join(API_ROOT, relativePath), 'utf8');
}

function productionTypescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionTypescriptFiles(absolutePath);
    }
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [absolutePath]
      : [];
  });
}

function prismaModel(source: string, modelName: string): string {
  return source.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';
}

function baselineTable(source: string, tableName: string): string {
  return source.match(new RegExp(`CREATE TABLE "${tableName}" \\([\\s\\S]*?\\n\\);`))?.[0] ?? '';
}

describe('auth verification persistence boundary', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const baseline = readFileSync(BASELINE_PATH, 'utf8');

  it('verification persistence는 raw email/IP 대신 versioned HMAC dimension을 저장한다', () => {
    const codeModel = prismaModel(schema, 'VerificationCode');
    const requestLogModel = prismaModel(schema, 'VerificationCodeRequestLog');
    const codeTable = baselineTable(baseline, 'VerificationCode');
    const requestLogTable = baselineTable(baseline, 'VerificationCodeRequestLog');

    for (const source of [codeModel, requestLogModel, codeTable, requestLogTable]) {
      expect(source).toContain('subjectKey');
      expect(source).not.toMatch(/^\s*(?:"?emailNormalized"?)\s+/m);
      expect(source).not.toMatch(/^\s*(?:"?requestIp"?)\s+/m);
    }
    expect(codeModel).toContain('requestIpKey');
    expect(requestLogModel).toContain('requestIpKey');
  });

  it('verification code TTL, grant TTL, delivery lifecycle은 서로 다른 column으로 유지한다', () => {
    const codeModel = prismaModel(schema, 'VerificationCode');

    expect(codeModel).toContain('codeExpiresAt');
    expect(codeModel).toContain('grantExpiresAt');
    expect(codeModel).toContain('deliveryStatus');
    expect(codeModel).toContain('activatedAt');
    expect(codeModel).toContain('providerCorrelationId');
    expect(codeModel).not.toMatch(/^\s*expiresAt\s+/m);
  });

  it('mail outbox는 암호화 payload와 운영 lifecycle만 노출한다', () => {
    const outboxModel = prismaModel(schema, 'AuthMailOutboxEvent');
    const outboxTable = baselineTable(baseline, 'AuthMailOutboxEvent');

    for (const source of [outboxModel, outboxTable]) {
      expect(source).toContain('payloadCiphertext');
      expect(source).toContain('payloadIv');
      expect(source).toContain('payloadAuthTag');
      expect(source).toContain('keyVersion');
      expect(source).not.toMatch(/^\s*(?:"?emailNormalized"?)\s+/m);
    }
    expect(outboxTable).not.toMatch(/^\s*"verificationCode"\s+/m);
    expect(baseline).toContain(
      'CREATE INDEX "AuthMailOutboxEvent_status_availableAt_createdAt_id_idx" ON "AuthMailOutboxEvent"("status", "availableAt", "createdAt", "id")',
    );
  });

  it('active lookup와 abuse backstop TypedSQL은 HMAC dimension과 전용 index를 사용한다', () => {
    const activeLookup = readApiFile('prisma/sql/getActiveVerificationRecord.sql');
    const cooldownLookup = readApiFile('prisma/sql/getVerificationRetryAfterSeconds.sql');
    const backstopLookup = readApiFile('prisma/sql/getVerificationBackstopRetryAfterSeconds.sql');

    expect(activeLookup).toContain('"subjectKey" = $1');
    expect(activeLookup).toContain('"codeExpiresAt" > CURRENT_TIMESTAMP');
    expect(activeLookup).toContain('"deliveryStatus" = \'ACCEPTED\'');
    expect(cooldownLookup).toContain('"subjectKey" = $1');
    expect(cooldownLookup).toContain('"requestIpKey" = $3');
    expect(backstopLookup).toContain('"subjectKey" = $1');
    expect(baseline).toContain(
      'CREATE INDEX "VerificationCode_subjectKey_purpose_activatedAt_codeExpiresAt_idx"',
    );
    expect(baseline).toContain('CREATE INDEX "VerificationCode_active_lookup_idx"');
    expect(baseline).toContain(
      'CREATE INDEX "VerificationCodeRequestLog_subjectKey_purpose_requestIpKey_cre_idx"',
    );
    expect(baseline).toContain('CREATE INDEX "VerificationRequestLog_subject_purpose_created_idx"');
  });

  it('auth mail claim은 bounded SKIP LOCKED lease를 사용하고 decrypt owner는 dispatcher로 제한한다', () => {
    const claim = readApiFile('prisma/sql/claimAuthMailOutboxEvents.sql');
    const readerImportOwners = productionTypescriptFiles(path.join(API_ROOT, 'src/auth'))
      .filter(
        (filePath) =>
          filePath !== path.join(API_ROOT, 'src/auth/mail/auth-mail-envelope-reader.service.ts'),
      )
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('auth-mail-envelope-reader'))
      .map((filePath) => path.relative(API_ROOT, filePath))
      .sort();

    expect(claim).toContain('FOR UPDATE SKIP LOCKED');
    expect(claim).toContain('ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC');
    expect(claim).toContain('LIMIT $4');
    expect(claim).toContain('"status" = \'PROCESSING\'');
    expect(readerImportOwners).toEqual([
      'src/auth/composition/auth.providers.ts',
      'src/auth/mail/auth-mail-dispatcher.service.ts',
    ]);
  });
});
