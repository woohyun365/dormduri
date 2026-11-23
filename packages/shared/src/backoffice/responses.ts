import { z } from 'zod';
import {
  accessRequestKindSchema,
  accessRequestStatusSchema,
  backofficeErrorCodeSchema,
  backofficePermissionSchema,
  backofficeRoleSchema,
  backofficeSessionScopeSchema,
} from './contract.js';

/**
 * Response bodies of the backoffice API as the BFF reads them (apps/backoffice-web). The BFF parses
 * every upstream body with these schemas and answers with a fixed error when one does not match, so
 * a drift between the API and the screen shows up as a failed request, not as a half-read value.
 */

const idSchema = z.uuid();
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const nullableDateTimeSchema = isoDateTimeSchema.nullable();
const recoveryCodeSchema = z.string().regex(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/u);

/** The session token goes to the BFF cookie only; the BFF never forwards it to the page. */
export const issuedSessionResponseSchema = z.object({
  session: z.object({
    token: z.string().min(32).max(256),
    scope: backofficeSessionScopeSchema,
    absoluteExpiresAt: isoDateTimeSchema,
  }),
});

// WebAuthn options are built by SimpleWebAuthn on the API and read by the browser library, which
// checks every field. The contract bounds only what the BFF relies on.
export const webAuthnOptionsSchema = z.looseObject({
  challenge: z.string().min(16).max(512),
});
export const webAuthnChallengeResponseSchema = z.object({
  challengeId: idSchema,
  options: webAuthnOptionsSchema,
});

export const loginPasswordResponseSchema = webAuthnChallengeResponseSchema.extend({
  recovery: z.object({ totp: z.boolean(), recoveryCode: z.boolean() }),
});

export const registrationOptionsResponseSchema = webAuthnChallengeResponseSchema.extend({
  email: z.string().min(1).max(254),
  displayName: z.string().min(1).max(80),
});

/** TOTP secret and recovery codes appear once, in the response that issues them. */
export const issuedTotpSchema = z.object({
  secret: z.string().regex(/^[A-Z2-7]{16,64}$/u),
  uri: z.string().startsWith('otpauth://totp/').max(512),
});
export const recoveryCodesResponseSchema = z.object({
  recoveryCodes: z.array(recoveryCodeSchema).min(1).max(20),
});

export const registrationResponseSchema = issuedSessionResponseSchema.extend({
  accountId: idSchema,
  totp: issuedTotpSchema,
  recoveryCodes: recoveryCodesResponseSchema.shape.recoveryCodes,
});

export const sessionInfoResponseSchema = z.object({
  account: z.object({
    id: idSchema,
    email: z.string().min(1).max(254),
    displayName: z.string().min(1).max(80),
  }),
  scope: backofficeSessionScopeSchema,
  roles: z.array(backofficeRoleSchema),
  permissions: z.array(backofficePermissionSchema),
  idleExpiresAt: isoDateTimeSchema,
  absoluteExpiresAt: isoDateTimeSchema,
  reauthenticatedUntil: nullableDateTimeSchema,
  totpConfirmed: z.boolean(),
  recoveryCodesRemaining: z.number().int().min(0),
  passkeyCount: z.number().int().min(0),
});

export const reauthenticationResponseSchema = z.object({
  reauthenticatedUntil: isoDateTimeSchema,
});
export const passkeyRegisteredResponseSchema = z.object({ passkeyId: idSchema });

export const accountStatusSchema = z.enum(['ACTIVE', 'DEACTIVATED']);
export const invitationKindSchema = z.enum(['BOOTSTRAP_OWNER', 'OPERATOR']);
export const accountListResponseSchema = z.object({
  accounts: z.array(
    z.object({
      id: idSchema,
      email: z.string().min(1).max(254),
      displayName: z.string().min(1).max(80),
      status: accountStatusSchema,
      locked: z.boolean(),
      roles: z.array(backofficeRoleSchema),
      lastLoginAt: nullableDateTimeSchema,
      deactivatedAt: nullableDateTimeSchema,
      createdAt: isoDateTimeSchema,
    }),
  ),
  invitations: z.array(
    z.object({
      id: idSchema,
      kind: invitationKindSchema,
      email: z.string().min(1).max(254),
      displayName: z.string().min(1).max(80),
      expiresAt: isoDateTimeSchema,
    }),
  ),
});

/** The invitation code appears once; the owner hands it to the new operator out of band. */
export const invitationCreatedResponseSchema = z.object({
  invitationId: idSchema,
  code: z.string().min(16).max(128),
  expiresAt: isoDateTimeSchema,
});

export const roleCatalogResponseSchema = z.object({
  roles: z.array(
    z.object({ role: backofficeRoleSchema, permissions: z.array(backofficePermissionSchema) }),
  ),
});

const pageCursorSchema = z.object({ beforeTime: isoDateTimeSchema, beforeId: idSchema });

export const accessRequestSchema = z.object({
  id: idSchema,
  kind: accessRequestKindSchema,
  status: accessRequestStatusSchema,
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  targetAccountId: idSchema.nullable(),
  targetRole: backofficeRoleSchema.nullable(),
  requestedByAccountId: idSchema,
  requestReason: z.string().nullable(),
  expiresAt: isoDateTimeSchema,
  decidedByAccountId: idSchema.nullable(),
  closedAt: nullableDateTimeSchema,
  decisionReason: z.string().nullable(),
  selfApproved: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export const accessRequestListResponseSchema = z.object({
  requests: z.array(accessRequestSchema),
  nextPage: pageCursorSchema.nullable(),
});

// Audit codes stay strings: the screen shows a known code by name and an unknown one as it is, so a
// new action on the API does not break the audit list before the screen learns its name.
export const auditEventSchema = z.object({
  id: idSchema,
  occurredAt: isoDateTimeSchema,
  actorType: z.string().min(1).max(32),
  actorAccountId: idSchema.nullable(),
  sessionId: idSchema.nullable(),
  accessPath: z.string().min(1).max(32).nullable(),
  action: z.string().min(1).max(64),
  targetType: z.string().min(1).max(64).nullable(),
  targetId: z.string().max(128).nullable(),
  approvalRequestId: idSchema.nullable(),
  result: z.string().min(1).max(32),
  selfApproved: z.boolean(),
  reason: z.string().nullable(),
  requestId: z.string().max(128).nullable(),
  metadata: z.unknown(),
});
export const auditEventListResponseSchema = z.object({
  events: z.array(auditEventSchema),
  nextPage: pageCursorSchema.nullable(),
});
export const auditReviewRecordedResponseSchema = z.object({ auditEventId: idSchema });

export const backofficeErrorResponseSchema = z.object({
  error: z.object({ code: backofficeErrorCodeSchema, requestId: z.string().max(128).optional() }),
});

export type IssuedSessionResponse = z.infer<typeof issuedSessionResponseSchema>;
export type WebAuthnOptions = z.infer<typeof webAuthnOptionsSchema>;
export type WebAuthnChallengeResponse = z.infer<typeof webAuthnChallengeResponseSchema>;
export type LoginPasswordResponse = z.infer<typeof loginPasswordResponseSchema>;
export type RegistrationOptionsResponse = z.infer<typeof registrationOptionsResponseSchema>;
export type IssuedTotp = z.infer<typeof issuedTotpSchema>;
export type RecoveryCodesResponse = z.infer<typeof recoveryCodesResponseSchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
export type SessionInfoResponse = z.infer<typeof sessionInfoResponseSchema>;
export type ReauthenticationResponse = z.infer<typeof reauthenticationResponseSchema>;
export type AccountListResponse = z.infer<typeof accountListResponseSchema>;
export type InvitationCreatedResponse = z.infer<typeof invitationCreatedResponseSchema>;
export type RoleCatalogResponse = z.infer<typeof roleCatalogResponseSchema>;
export type AccessRequest = z.infer<typeof accessRequestSchema>;
export type AccessRequestListResponse = z.infer<typeof accessRequestListResponseSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditEventListResponse = z.infer<typeof auditEventListResponseSchema>;
export type BackofficeErrorResponse = z.infer<typeof backofficeErrorResponseSchema>;
