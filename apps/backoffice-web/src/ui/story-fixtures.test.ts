import type { ZodType } from 'zod';
import {
  accessRequestListResponseSchema,
  accountListResponseSchema,
  auditEventListResponseSchema,
  invitationCreatedResponseSchema,
  issuedTotpSchema,
  loginPasswordResponseSchema,
  recoveryCodesResponseSchema,
  registrationOptionsResponseSchema,
  roleCatalogResponseSchema,
  sessionInfoResponseSchema,
  webAuthnChallengeResponseSchema,
} from '@repo/shared/backoffice';
import { describe, expect, it } from 'vitest';
import {
  accountList,
  activeAuditor,
  activeOwner,
  auditEvents,
  decidedRequests,
  invitationCreated,
  issuedTotp,
  loginChallenge,
  longAccountList,
  manyAccountList,
  manyAuditEvents,
  ownerWithoutRecovery,
  pageCursor,
  passkeyOptions,
  pendingRequests,
  recoveryCodes,
  registrationInvitation,
  roleCatalog,
} from './__stories__/fixtures';

// Story fixtures stand for backoffice API answers (design guide ⑨). Each one passes the shared schema the BFF parses
// that answer with, so a story never shows a value the API cannot send.
const fixtures: ReadonlyArray<readonly [string, ZodType, unknown]> = [
  ['owner session', sessionInfoResponseSchema, activeOwner.session],
  ['auditor session', sessionInfoResponseSchema, activeAuditor.session],
  ['owner session without recovery', sessionInfoResponseSchema, ownerWithoutRecovery],
  ['account list', accountListResponseSchema, accountList],
  ['account list with a long name', accountListResponseSchema, longAccountList],
  ['account list of fifty', accountListResponseSchema, manyAccountList],
  ['role catalog', roleCatalogResponseSchema, { roles: roleCatalog }],
  [
    'access requests and page cursor',
    accessRequestListResponseSchema,
    { requests: pendingRequests, nextPage: pageCursor },
  ],
  [
    'decided requests',
    accessRequestListResponseSchema,
    { requests: decidedRequests, nextPage: null },
  ],
  ['audit events', auditEventListResponseSchema, { events: auditEvents, nextPage: pageCursor }],
  [
    'audit events of fifty',
    auditEventListResponseSchema,
    { events: manyAuditEvents, nextPage: null },
  ],
  ['created invitation', invitationCreatedResponseSchema, invitationCreated],
  ['issued TOTP', issuedTotpSchema, issuedTotp],
  ['recovery codes', recoveryCodesResponseSchema, { recoveryCodes }],
  ['login challenge', loginPasswordResponseSchema, loginChallenge],
  ['registration invitation', registrationOptionsResponseSchema, registrationInvitation],
  ['new passkey options', webAuthnChallengeResponseSchema, passkeyOptions],
];

describe('story fixtures', () => {
  it.each(fixtures)('%s matches the shared response schema', (_, schema, value) => {
    expect(schema.safeParse(value).error?.issues).toBeUndefined();
  });
});
