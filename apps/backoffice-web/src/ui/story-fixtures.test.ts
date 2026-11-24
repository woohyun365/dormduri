import type { ZodType } from 'zod';
import {
  accessRequestListResponseSchema,
  accountListResponseSchema,
  auditEventListResponseSchema,
  issuedTotpSchema,
  loginPasswordResponseSchema,
  recoveryCodesResponseSchema,
  registrationOptionsResponseSchema,
  roleCatalogResponseSchema,
  sessionInfoResponseSchema,
} from '@repo/shared/backoffice';
import { describe, expect, it } from 'vitest';
import {
  accountList,
  activeAuditor,
  activeOwner,
  auditEvents,
  issuedTotp,
  loginChallenge,
  pageCursor,
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
  ['account list', accountListResponseSchema, accountList],
  ['role catalog', roleCatalogResponseSchema, { roles: roleCatalog }],
  [
    'access requests and page cursor',
    accessRequestListResponseSchema,
    { requests: pendingRequests, nextPage: pageCursor },
  ],
  ['audit events', auditEventListResponseSchema, { events: auditEvents, nextPage: pageCursor }],
  ['issued TOTP', issuedTotpSchema, issuedTotp],
  ['recovery codes', recoveryCodesResponseSchema, { recoveryCodes }],
  ['login challenge', loginPasswordResponseSchema, loginChallenge],
  ['registration invitation', registrationOptionsResponseSchema, registrationInvitation],
];

describe('story fixtures', () => {
  it.each(fixtures)('%s matches the shared response schema', (_, schema, value) => {
    expect(schema.safeParse(value).error?.issues).toBeUndefined();
  });
});
