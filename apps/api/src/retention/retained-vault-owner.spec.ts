import { Prisma } from '../generated/prisma/client.js';
import {
  createEnvRetentionVaultKeyring,
  createRetentionVaultCipher,
  createStaticRetentionVaultKeyring,
  discloseRetainedVaultPayload,
  disposeDueRetainedVaultObjects,
  ensureRetentionCaseTx,
  parseRetainedMatchHistoryPayload,
  parseRetainedNicknameAuditPayload,
  parseRetainedSeasonProfileHistoryPayload,
  retainVaultPayloadTx,
} from './retained-vault-owner.js';

describe('retained-vault-owner', () => {
  const now = new Date('2026-05-18T00:00:00.000Z');
  const cipher = createRetentionVaultCipher({
    key: Buffer.alloc(32, 31),
    keyVersion: 'vault-test-v1',
  });
  const keyring = createStaticRetentionVaultKeyring({ NICKNAME_AUDIT: cipher });

  it('env keyring은 RETENTION_VAULT_* canonical key만 사용하고 legacy fallback을 읽지 않는다', () => {
    const envKeys = [
      'RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64',
      'RETENTION_VAULT_CHAT_BODY_KEY_VERSION',
      'RETENTION_CHAT_BODY_ENCRYPTION_KEY_BASE64',
      'RETENTION_CHAT_BODY_KEY_VERSION',
    ] as const;
    const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

    try {
      for (const key of envKeys) {
        delete process.env[key];
      }
      process.env.RETENTION_CHAT_BODY_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 11).toString(
        'base64',
      );
      process.env.RETENTION_CHAT_BODY_KEY_VERSION = 'legacy-chat-v1';

      expect(createEnvRetentionVaultKeyring().getCipher('CHAT_BODY')).toBeNull();

      process.env.RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 12).toString(
        'base64',
      );
      process.env.RETENTION_VAULT_CHAT_BODY_KEY_VERSION = 'canonical-chat-v1';

      expect(createEnvRetentionVaultKeyring().getCipher('CHAT_BODY')).toMatchObject({
        keyVersion: 'canonical-chat-v1',
      });
    } finally {
      for (const key of envKeys) {
        const value = previous[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it('retention case와 vault object를 idempotent하게 생성하고 HMAC digest/hold를 저장한다', async () => {
    const createdCases: Array<Record<string, unknown>> = [];
    const createdObjects: Array<Record<string, unknown>> = [];
    const upsertedHolds: Array<Record<string, unknown>> = [];
    const tx = {
      retentionCase: {
        findFirst: jest.fn().mockResolvedValueOnce(null),
        create: jest.fn().mockImplementation(({ data }) => {
          createdCases.push(data as Record<string, unknown>);
          return Promise.resolve({ id: 'case-1' });
        }),
      },
      retainedVaultObject: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'vault-1', state: 'RETAINED' }),
        create: jest.fn().mockImplementation(({ data }) => {
          createdObjects.push(data as Record<string, unknown>);
          return Promise.resolve({ id: 'vault-1' });
        }),
      },
      retainedVaultObjectHold: {
        upsert: jest.fn().mockImplementation((input) => {
          upsertedHolds.push(input as Record<string, unknown>);
          return Promise.resolve({ id: 'hold-1' });
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const retentionCase = await ensureRetentionCaseTx(tx, {
      reason: 'ACCOUNT_DELETION',
      triggerUserId: 'user-a',
      triggerRetainedIdentityId: 'identity-a',
      sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
      sourceId: 'event-a',
      retentionHoldUntil: new Date('2026-05-23T00:00:00.000Z'),
    });

    const first = await retainVaultPayloadTx(
      tx,
      {
        target: 'NICKNAME_AUDIT_EVENT',
        sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
        sourceId: 'event-a',
        subjectUserId: 'user-a',
        subjectRetainedIdentityId: 'identity-a',
        subjectRole: 'USER',
        keyPurpose: 'NICKNAME_AUDIT',
        payloadSchemaVersion: 1,
        plaintext: {
          schemaVersion: 1,
          event: { id: 'event-a', previousNickname: '이전', nextNickname: '다음' },
        },
        aad: 'knu-roommate:test:event-a',
        retainedAt: now,
        retentionCaseId: retentionCase.id,
        holdReason: 'ACCOUNT_DELETION',
        holdUntil: new Date('2026-05-23T00:00:00.000Z'),
      },
      { keyring },
    );
    const second = await retainVaultPayloadTx(
      tx,
      {
        target: 'NICKNAME_AUDIT_EVENT',
        sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
        sourceId: 'event-a',
        subjectUserId: 'user-a',
        subjectRetainedIdentityId: 'identity-a',
        subjectRole: 'USER',
        keyPurpose: 'NICKNAME_AUDIT',
        payloadSchemaVersion: 1,
        plaintext: {
          schemaVersion: 1,
          event: { id: 'event-a', previousNickname: '이전', nextNickname: '다음' },
        },
        aad: 'knu-roommate:test:event-a',
        retainedAt: now,
        retentionCaseId: retentionCase.id,
        holdReason: 'ACCOUNT_DELETION',
        holdUntil: new Date('2026-05-23T00:00:00.000Z'),
      },
      { keyring },
    );

    expect(first).toEqual({ id: 'vault-1', created: true });
    expect(second).toEqual({ id: 'vault-1', created: false });
    expect(createdCases[0]).toMatchObject({
      reason: 'ACCOUNT_DELETION',
      triggerUserId: 'user-a',
      triggerRetainedIdentityId: 'identity-a',
      policyVersion: 'rrpd-v1',
    });
    expect(createdObjects).toHaveLength(1);
    expect(createdObjects[0]).toMatchObject({
      target: 'NICKNAME_AUDIT_EVENT',
      sourceId: 'event-a',
      subjectRole: 'USER',
      keyPurpose: 'NICKNAME_AUDIT',
      keyVersion: 'vault-test-v1',
    });
    expect(createdObjects[0]?.encryptedPayload).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'vault-test-v1',
    });
    expect(createdObjects[0]?.payloadDigest).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(upsertedHolds).toHaveLength(2);
    const firstHold = upsertedHolds[0] as { create?: Record<string, unknown> };
    expect(firstHold.create).toMatchObject({
      retainedVaultObjectId: 'vault-1',
      retentionCaseId: 'case-1',
      holdReason: 'ACCOUNT_DELETION',
    });
  });

  it('disclosure는 approval reference를 요구하고 성공/거부 접근 로그를 남긴다', async () => {
    const encryptedPayload = await createEncryptedNicknamePayload();
    const accessLogs: Array<Record<string, unknown>> = [];
    const prisma = {
      retainedVaultObject: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'vault-1',
          target: 'NICKNAME_AUDIT_EVENT',
          sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
          sourceId: 'event-a',
          subjectRole: 'USER',
          subjectRetainedIdentityId: 'identity-a',
          encryptedPayload,
          keyPurpose: 'NICKNAME_AUDIT',
          keyVersion: 'vault-test-v1',
          aad: 'knu-roommate:test:event-a',
          state: 'RETAINED',
          disposedAt: null,
        }),
      },
      retentionAccessLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          accessLogs.push(data as Record<string, unknown>);
          return Promise.resolve({ id: `log-${accessLogs.length}` });
        }),
      },
    };

    await expect(
      discloseRetainedVaultPayload(
        prisma as never,
        {
          retainedVaultObjectId: 'vault-1',
          accessedBy: 'ops-1',
          accessReason: 'REPORT_REVIEW',
          approvalReference: '',
          purpose: '신고 검토',
          parsePlaintext: parseRetainedNicknameAuditPayload,
        },
        { keyring },
      ),
    ).rejects.toThrow('approvalReference is required');

    const disclosure = await discloseRetainedVaultPayload(
      prisma as never,
      {
        retainedVaultObjectId: 'vault-1',
        accessedBy: 'ops-1',
        accessReason: 'REPORT_REVIEW',
        approvalReference: 'report-1',
        purpose: '신고 검토',
        now,
        parsePlaintext: parseRetainedNicknameAuditPayload,
      },
      { keyring },
    );

    expect(disclosure.payload).toEqual({
      schemaVersion: 1,
      event: { id: 'event-a', previousNickname: '이전', nextNickname: '다음' },
    });
    expect(accessLogs).toEqual([
      expect.objectContaining({
        retainedVaultObjectId: 'vault-1',
        retainedIdentityId: 'identity-a',
        targetType: 'VAULT_OBJECT',
        vaultTarget: 'NICKNAME_AUDIT_EVENT',
        accessedBy: 'ops-1',
        accessReason: 'REPORT_REVIEW',
        approvalReference: 'report-1',
        result: 'DISCLOSED',
        disclosedFields: ['payload'],
      }),
    ]);

    await expect(
      discloseRetainedVaultPayload(
        prisma as never,
        {
          retainedVaultObjectId: 'vault-1',
          accessedBy: 'ops-1',
          accessReason: 'REPORT_REVIEW',
          approvalReference: 'report-2',
          purpose: '키 누락 검증',
          parsePlaintext: parseRetainedNicknameAuditPayload,
        },
        { keyring: createStaticRetentionVaultKeyring({ NICKNAME_AUDIT: null }) },
      ),
    ).rejects.toThrow('disclosure key unavailable');
    expect(accessLogs.at(-1)).toMatchObject({ result: 'DENIED', disclosedFields: [] });
  });

  it('target별 retained payload parser는 canonical schema wrapper만 허용한다', () => {
    expect(
      parseRetainedNicknameAuditPayload({
        schemaVersion: 1,
        event: { id: 'event-a', previousNickname: '이전', nextNickname: '다음' },
      }),
    ).toMatchObject({ schemaVersion: 1, event: { id: 'event-a' } });
    expect(
      parseRetainedSeasonProfileHistoryPayload({
        schemaVersion: 1,
        history: { id: 'history-a', participantId: 'participant-a' },
      }),
    ).toMatchObject({ schemaVersion: 1, history: { participantId: 'participant-a' } });
    expect(
      parseRetainedMatchHistoryPayload({
        schemaVersion: 1,
        subjectRole: 'VIEWER',
        entry: { id: 'match-history-a' },
      }),
    ).toMatchObject({ schemaVersion: 1, subjectRole: 'VIEWER' });

    expect(() =>
      parseRetainedNicknameAuditPayload({ schemaVersion: 1, event: { nextNickname: '다음' } }),
    ).toThrow('nickname audit payload invalid');
    expect(() =>
      parseRetainedSeasonProfileHistoryPayload({ schemaVersion: 1, history: { id: 'history-a' } }),
    ).toThrow('profile history payload invalid');
    expect(() =>
      parseRetainedMatchHistoryPayload({
        schemaVersion: 1,
        subjectRole: 'MESSAGE_SENDER',
        entry: { id: 'match-history-a' },
      }),
    ).toThrow('match history payload invalid');
  });

  it('due vault object disposal은 encrypted payload/key/digest를 null 처리하고 DISPOSED 로그를 남긴다', async () => {
    const updatedObjects: Array<Record<string, unknown>> = [];
    const accessLogs: Array<Record<string, unknown>> = [];
    const prisma = {
      retainedVaultObject: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'vault-1',
            target: 'NICKNAME_AUDIT_EVENT',
            subjectRetainedIdentityId: 'identity-a',
          },
        ]),
        update: jest.fn().mockImplementation(({ data }) => {
          updatedObjects.push(data as Record<string, unknown>);
          return Promise.resolve({ id: 'vault-1' });
        }),
      },
      retentionAccessLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          accessLogs.push(data as Record<string, unknown>);
          return Promise.resolve({ id: 'log-1' });
        }),
      },
    };

    const result = await disposeDueRetainedVaultObjects(prisma as never, now);

    expect(result).toEqual({ processedCount: 1 });
    expect(updatedObjects[0]).toMatchObject({
      encryptedPayload: Prisma.JsonNull,
      payloadDigest: null,
      keyVersion: null,
      state: 'DISPOSED',
      disposedAt: now,
      disposalReason: 'RETENTION_HOLD_EXPIRED',
    });
    expect(accessLogs[0]).toMatchObject({
      retainedVaultObjectId: 'vault-1',
      retainedIdentityId: 'identity-a',
      targetType: 'VAULT_OBJECT',
      vaultTarget: 'NICKNAME_AUDIT_EVENT',
      accessedBy: 'SYSTEM',
      accessReason: 'RETENTION_EXPIRY_REVIEW',
      result: 'DISPOSED',
      disclosedFields: [],
    });
  });

  async function createEncryptedNicknamePayload() {
    let encryptedPayload: unknown;
    const createRetainedVaultObject = jest.fn((input: { data: { encryptedPayload?: unknown } }) => {
      encryptedPayload = input.data.encryptedPayload;
      return Promise.resolve({ id: 'vault-1' });
    });
    const tx = {
      retainedVaultObject: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: createRetainedVaultObject,
      },
      retainedVaultObjectHold: { upsert: jest.fn().mockResolvedValue({ id: 'hold-1' }) },
    } as unknown as Prisma.TransactionClient;

    await retainVaultPayloadTx(
      tx,
      {
        target: 'NICKNAME_AUDIT_EVENT',
        sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
        sourceId: 'event-a',
        subjectUserId: 'user-a',
        subjectRetainedIdentityId: 'identity-a',
        subjectRole: 'USER',
        keyPurpose: 'NICKNAME_AUDIT',
        payloadSchemaVersion: 1,
        plaintext: {
          schemaVersion: 1,
          event: { id: 'event-a', previousNickname: '이전', nextNickname: '다음' },
        },
        aad: 'knu-roommate:test:event-a',
        retainedAt: now,
      },
      { keyring },
    );

    return encryptedPayload;
  }
});
