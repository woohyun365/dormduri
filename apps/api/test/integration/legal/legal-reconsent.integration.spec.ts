import { ConflictException } from '@nestjs/common';
import { Client } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { toLegalKstDate } from '@repo/shared/legal';
import { LegalReconsentCommand } from '../../../src/legal/commands/legal-reconsent.command.js';
import { useIntegrationTestSuite } from '../_support/integration-suite.js';

const DAY_MS = 24 * 60 * 60 * 1_000;

interface VersionFixture {
  readonly id: string;
  readonly kind: string;
  readonly noticeClass: 'INITIAL' | 'GENERAL';
  readonly consentRequired: boolean;
  readonly effectiveDaysAgo: number;
}

interface StoredRecord {
  userId: string;
  documentVersionId: string;
  kind: string;
  action: string;
  source: string;
}

// The terms of service asked for consent again yesterday; the other kinds are first publications.
const VERSIONS: readonly VersionFixture[] = [
  {
    id: 'reconsent-terms-initial',
    kind: 'TERMS_OF_SERVICE',
    noticeClass: 'INITIAL',
    consentRequired: false,
    effectiveDaysAgo: 40,
  },
  {
    id: 'reconsent-terms-revision',
    kind: 'TERMS_OF_SERVICE',
    noticeClass: 'GENERAL',
    consentRequired: true,
    effectiveDaysAgo: 1,
  },
  {
    id: 'reconsent-privacy-initial',
    kind: 'PRIVACY_POLICY',
    noticeClass: 'INITIAL',
    consentRequired: false,
    effectiveDaysAgo: 40,
  },
  {
    id: 'reconsent-consent-initial',
    kind: 'PERSONAL_DATA_COLLECTION_USE_CONSENT',
    noticeClass: 'INITIAL',
    consentRequired: false,
    effectiveDaysAgo: 40,
  },
  {
    id: 'reconsent-age-initial',
    kind: 'AGE_14_OR_ABOVE_NOTICE',
    noticeClass: 'INITIAL',
    consentRequired: false,
    effectiveDaysAgo: 40,
  },
];

const MEMBERS = ['reconsent-member-a', 'reconsent-member-b'] as const;

function isConsentStale(error: unknown): boolean {
  return (
    error instanceof ConflictException &&
    (error.getResponse() as { code?: unknown }).code === 'LEGAL_CONSENT_STALE'
  );
}

/**
 * Reconsent against PostgreSQL with the user API role (separated role mode in CI): the published
 * version read, the AGREE insert with source RECONSENT, the unique (member, version) key and the
 * source CHECK all run for real.
 */
describe('legal reconsent integration', () => {
  const suite = useIntegrationTestSuite('legal_reconsent');
  let command: LegalReconsentCommand;

  async function withAdmin<T>(work: (client: Client) => Promise<T>): Promise<T> {
    // Published versions and verification reads use the suite admin connection: no runtime role
    // writes published legal versions.
    const client = new Client({ connectionString: suite.databaseSandbox.databaseUrl });
    await client.connect();
    try {
      return await work(client);
    } finally {
      await client.end();
    }
  }

  async function storedRecords(): Promise<StoredRecord[]> {
    return withAdmin(async (client) => {
      const result = await client.query<StoredRecord>(`
        SELECT "userId", "documentVersionId", "kind"::text AS "kind", "action"::text AS "action", "source"
        FROM "LegalAcceptanceRecord"
        ORDER BY "userId", "documentVersionId"
      `);
      return result.rows;
    });
  }

  beforeEach(async () => {
    command = suite.app.get(LegalReconsentCommand);
    const databaseNow = await suite.prisma.getDatabaseNow();
    await withAdmin(async (client) => {
      for (const version of VERSIONS) {
        const effectiveDate = toLegalKstDate(
          new Date(databaseNow.getTime() - version.effectiveDaysAgo * DAY_MS),
        );
        await client.query(
          `
            INSERT INTO "LegalDocumentVersion" (
              "id", "kind", "version", "title", "summaryItems", "sections", "changeSummary",
              "noticeClass", "consentRequired", "effectiveDate", "contentDigest", "publishedAt"
            ) VALUES (
              $1, $2::"LegalDocumentKind", $1, $1, '[]'::jsonb,
              '[{"type":"paragraph","text":"본문"}]'::jsonb, '변경 요약',
              $3::"LegalNoticeClass", $4, $5::date, repeat('0', 64),
              $6::timestamptz - interval '50 days'
            )
          `,
          [
            version.id,
            version.kind,
            version.noticeClass,
            version.consentRequired,
            effectiveDate,
            databaseNow,
          ],
        );
      }
    });
    for (const userId of MEMBERS) {
      await suite.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@kangwon.ac.kr`,
          emailNormalized: `${userId}@kangwon.ac.kr`,
          passwordHash: 'integration-password-hash',
          gender: 'M',
          campus: 'CHUNCHEON',
          emailVerifiedAt: databaseNow,
        },
      });
      // Signup agreed to the first terms of service, before the revision that asks again.
      await suite.prisma.legalAcceptanceRecord.create({
        data: {
          userId,
          documentVersionId: 'reconsent-terms-initial',
          kind: 'TERMS_OF_SERVICE',
          action: 'AGREE',
          source: 'SIGNUP',
        },
      });
    }
  });

  it('대기 판에 동의하면 출처 RECONSENT 기록 하나가 생기고 그 회원의 대기만 사라진다', async () => {
    const [memberA, memberB] = MEMBERS;
    const before = await command.getPending(memberA);
    expect(before.pending.map((entry) => [entry.kind, entry.document.id])).toEqual([
      ['TERMS_OF_SERVICE', 'reconsent-terms-revision'],
    ]);

    const after = await command.record(memberA, ['reconsent-terms-revision']);

    expect(after.pending).toEqual([]);
    expect((await command.getPending(memberA)).pending).toEqual([]);
    expect((await command.getPending(memberB)).pending).toHaveLength(1);
    expect((await storedRecords()).filter((record) => record.source === 'RECONSENT')).toEqual([
      {
        userId: memberA,
        documentVersionId: 'reconsent-terms-revision',
        kind: 'TERMS_OF_SERVICE',
        action: 'AGREE',
        source: 'RECONSENT',
      },
    ]);
  });

  it('같은 판을 다시 보내면 409이고 기록은 하나다', async () => {
    const [memberA] = MEMBERS;
    await command.record(memberA, ['reconsent-terms-revision']);

    await expect(command.record(memberA, ['reconsent-terms-revision'])).rejects.toSatisfy(
      isConsentStale,
    );
    expect((await storedRecords()).filter((record) => record.source === 'RECONSENT')).toHaveLength(
      1,
    );
  });

  it('같은 회원이 동시에 두 번 보내면 하나만 기록되고 다른 하나는 409다', async () => {
    const [memberA] = MEMBERS;

    const results = await Promise.allSettled([
      command.record(memberA, ['reconsent-terms-revision']),
      command.record(memberA, ['reconsent-terms-revision']),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(isConsentStale((rejected[0] as PromiseRejectedResult).reason)).toBe(true);
    expect((await storedRecords()).filter((record) => record.source === 'RECONSENT')).toHaveLength(
      1,
    );
  });

  it('옛 판 id나 대기 밖 kind의 판이 섞이면 아무것도 쓰지 않는다', async () => {
    const [memberA] = MEMBERS;

    await expect(command.record(memberA, ['reconsent-terms-initial'])).rejects.toSatisfy(
      isConsentStale,
    );
    await expect(
      command.record(memberA, ['reconsent-terms-revision', 'reconsent-consent-initial']),
    ).rejects.toSatisfy(isConsentStale);
    expect((await storedRecords()).filter((record) => record.source === 'RECONSENT')).toEqual([]);
    expect((await command.getPending(memberA)).pending).toHaveLength(1);
  });
});
