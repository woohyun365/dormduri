import { describe, expect, it } from 'vitest';
import {
  COLUMN_CLASSES,
  readColumnClasses,
  readPrismaSchemaShape,
} from '../../support/database/role-grant-inputs.js';

/**
 * column-classes.csv is the column-level privacy class source (packages/database README):
 * read-only grants exclude secret·content, backoffice grants and log masking
 * read it. Every DB column is classified exactly once.
 */
describe('DB column privacy classes', () => {
  const schema = readPrismaSchemaShape();
  const classes = readColumnClasses();
  const key = (row: { table: string; column: string }) => `${row.table}.${row.column}`;

  it('schema.prisma의 모든 열이 한 번씩 분류되고 사라진 열은 남지 않는다', () => {
    const schemaColumns = new Set(schema.columns.map(key));
    const classified = classes.map(key);

    expect(schema.unknownFieldTypes).toEqual([]);
    expect(classified.filter((column, index) => classified.indexOf(column) !== index)).toEqual([]);
    expect([...schemaColumns].filter((column) => !classified.includes(column))).toEqual([]);
    expect(classified.filter((column) => !schemaColumns.has(column))).toEqual([]);
  });

  it('class는 정한 일곱 값이고 Prisma 이름이 DB 이름과 같다', () => {
    expect(
      classes.filter((row) => !(COLUMN_CLASSES as readonly string[]).includes(row.columnClass)),
    ).toEqual([]);
    // The grant pipeline matches Prisma model/field names against pg_class/pg_attribute.
    expect(schema.mappedNames).toEqual([]);
  });

  it('비밀·인증 값과 대화·자유 입력 본문은 secret·content로 분류된다', () => {
    const classOf = new Map(classes.map((row) => [key(row), row.columnClass]));

    for (const column of [
      'User.passwordHash',
      'AuthSession.sessionTokenHash',
      'AuthSession.refreshTokenHash',
      'AuthSession.previousRefreshTokenHash',
      'VerificationCode.codeHash',
      'VerificationCode.grantTokenHash',
      'AuthMailOutboxEvent.payloadCiphertext',
      'RetainedIdentity.encryptedIdentifierPayload',
      'RetainedVaultObject.encryptedPayload',
    ]) {
      expect(classOf.get(column), column).toBe('secret');
    }
    for (const column of [
      'ConversationMessage.body',
      'SupportTicketMessage.body',
      'ReportCase.detail',
      'SeasonParticipantProfile.intro',
      'ChatRealtimeOutboxEvent.payload',
      'NotificationOutboxEvent.lastError',
    ]) {
      expect(classOf.get(column), column).toBe('content');
    }
  });
});
