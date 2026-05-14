import {
  createRetainedIdentityCipher,
  decryptRetainedIdentifierPayload,
  encryptRetainedIdentifierPayload,
  resolveRetainedIdentityDecision,
} from './retained-identity-owner.js';
import { validateRetainedIdentityMetadata } from './retained-identity-metadata.validator.js';

describe('retained identity owner', () => {
  it('legal hold가 report/enforcement보다 우선한다', () => {
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');

    expect(
      resolveRetainedIdentityDecision({
        deletedAt,
        reportOpen: true,
        enforcementRecord: true,
        legalHoldReason: 'LAW_ENFORCEMENT_REQUEST',
      }),
    ).toMatchObject({
      retentionReason: 'LEGAL_HOLD',
      legalHoldReason: 'LAW_ENFORCEMENT_REQUEST',
      legalHoldAt: deletedAt,
    });
  });

  it.each([
    'LAW_ENFORCEMENT_REQUEST',
    'INTERNAL_DISPUTE_REVIEW',
    'SAFETY_INCIDENT',
    'ADMIN_LEGAL_REVIEW',
  ] as const)('%s legal hold는 수동 보존 만료일과 함께 LEGAL_HOLD로 분류한다', (reason) => {
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const manualRetentionUntil = new Date('2029-05-12T00:00:00.000Z');

    expect(
      resolveRetainedIdentityDecision({
        deletedAt,
        legalHoldReason: reason,
        manualRetentionUntil,
      }),
    ).toEqual({
      retentionReason: 'LEGAL_HOLD',
      legalHoldReason: reason,
      legalHoldAt: deletedAt,
      retentionHoldUntil: manualRetentionUntil,
    });
  });

  it('report/enforcement/dispute가 일반 account deletion보다 우선한다', () => {
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');

    expect(resolveRetainedIdentityDecision({ deletedAt, disputeOpen: true })).toMatchObject({
      retentionReason: 'DISPUTE_RESPONSE',
    });
    expect(resolveRetainedIdentityDecision({ deletedAt, reportOpen: true })).toMatchObject({
      retentionReason: 'REPORT_REVIEW',
    });
    expect(resolveRetainedIdentityDecision({ deletedAt, enforcementRecord: true })).toMatchObject({
      retentionReason: 'ENFORCEMENT_RECORD',
    });
    expect(resolveRetainedIdentityDecision({ deletedAt })).toMatchObject({
      retentionReason: 'ACCOUNT_DELETION',
      retentionHoldUntil: new Date('2026-05-17T00:00:00.000Z'),
    });
  });

  it('metadata는 schemaVersion과 허용 key만 받는다', () => {
    expect(
      validateRetainedIdentityMetadata({
        schemaVersion: 1,
        request: { requestedBy: 'USER', note: '탈퇴 요청' },
      }),
    ).toMatchObject({
      schemaVersion: 1,
      request: { requestedBy: 'USER', note: '탈퇴 요청' },
    });

    expect(() =>
      validateRetainedIdentityMetadata({
        schemaVersion: 1,
        email: 'blocked@example.com',
      }),
    ).toThrow('unsupported metadata key');
    expect(() =>
      validateRetainedIdentityMetadata({
        schemaVersion: 2,
      }),
    ).toThrow('schemaVersion=1');
    expect(() =>
      validateRetainedIdentityMetadata({
        schemaVersion: 1,
        archive: {},
      }),
    ).toThrow('unsupported metadata key');
  });

  it('retained identity 식별자 payload는 keyVersion이 맞는 암호키로만 복원된다', () => {
    const cipher = createRetainedIdentityCipher({
      key: Buffer.alloc(32, 7),
      keyVersion: 'test-v1',
    });
    const encrypted = encryptRetainedIdentifierPayload(cipher, {
      schemaVersion: 1,
      originalUserId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      emailNormalized: 'user-a@kangwon.ac.kr',
    });

    expect(encrypted).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'test-v1',
    });
    expect(decryptRetainedIdentifierPayload(cipher, encrypted)).toEqual({
      schemaVersion: 1,
      originalUserId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      emailNormalized: 'user-a@kangwon.ac.kr',
    });
    expect(() =>
      decryptRetainedIdentifierPayload(
        createRetainedIdentityCipher({ key: Buffer.alloc(32, 8), keyVersion: 'test-v2' }),
        encrypted,
      ),
    ).toThrow('key version mismatch');
  });
});
