import { z } from 'zod';

/**
 * Backoffice API contract (apps/backoffice-api ↔ apps/backoffice-web BFF). The browser never calls
 * the backoffice API; the BFF forwards these bodies and keeps the session token in its own cookie.
 */

// Permissions an operator role can hold (docs/policies/operator-access.md). Restricted permissions
// (`admin:restricted:*`) are not part of the contract: no role holds them and no route grants them.
export const backofficePermissionSchema = z.enum([
  'admin:account:invite',
  'admin:account:deactivate',
  'admin:access:request',
  'admin:access:approve',
  'admin:audit:read',
  'admin:audit:review',
  'admin:legal:edit',
  'admin:legal:approve',
]);
export type BackofficePermission = z.infer<typeof backofficePermissionSchema>;

export const backofficeRoleSchema = z.enum(['OWNER', 'AUDITOR', 'LEGAL_EDITOR', 'LEGAL_APPROVER']);
export type BackofficeRole = z.infer<typeof backofficeRoleSchema>;

export const backofficeSessionScopeSchema = z.enum(['FULL', 'RECOVERY']);
export type BackofficeSessionScope = z.infer<typeof backofficeSessionScopeSchema>;

const idSchema = z.uuid();
const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
const displayNameSchema = z.string().trim().min(1).max(80);
// Operators choose a long password; the second factor (passkey) carries the phishing resistance.
export const BACKOFFICE_PASSWORD_MIN_LENGTH = 12;
export const BACKOFFICE_PASSWORD_MAX_LENGTH = 128;
const passwordSchema = z
  .string()
  .min(BACKOFFICE_PASSWORD_MIN_LENGTH)
  .max(BACKOFFICE_PASSWORD_MAX_LENGTH);
const reasonSchema = z.string().trim().min(1).max(500);
const oneTimeCodeSchema = z.string().trim().min(16).max(128);
const totpCodeSchema = z.string().regex(/^\d{6}$/u);
const recoveryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/u);
const contentDigestSchema = z.string().regex(/^[a-f0-9]{64}$/u);

// WebAuthn credential JSON from the browser. The server library verifies every inner field; the
// contract only bounds the shape and size before it reaches the verifier.
const base64UrlSchema = z
  .string()
  .min(1)
  .max(16_384)
  .regex(/^[A-Za-z0-9_-]+$/u);
export const webAuthnRegistrationCredentialSchema = z.object({
  id: base64UrlSchema,
  rawId: base64UrlSchema,
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: base64UrlSchema,
    attestationObject: base64UrlSchema,
    transports: z.array(z.string().max(32)).max(8).optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});
export const webAuthnAuthenticationCredentialSchema = z.object({
  id: base64UrlSchema,
  rawId: base64UrlSchema,
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: base64UrlSchema,
    authenticatorData: base64UrlSchema,
    signature: base64UrlSchema,
    userHandle: base64UrlSchema.optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});

export const loginPasswordRequestSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(BACKOFFICE_PASSWORD_MAX_LENGTH),
});
export const loginPasskeyRequestSchema = z.strictObject({
  challengeId: idSchema,
  credential: webAuthnAuthenticationCredentialSchema,
});
export const loginTotpRequestSchema = z.strictObject({
  challengeId: idSchema,
  code: totpCodeSchema,
});
export const loginRecoveryCodeRequestSchema = z.strictObject({
  challengeId: idSchema,
  code: recoveryCodeSchema,
});

export const registrationOptionsRequestSchema = z.strictObject({
  code: oneTimeCodeSchema,
});
export const registrationRequestSchema = z.strictObject({
  code: oneTimeCodeSchema,
  password: passwordSchema,
  challengeId: idSchema,
  credential: webAuthnRegistrationCredentialSchema,
  passkeyLabel: z.string().trim().min(1).max(60).optional(),
});

export const reauthenticationRequestSchema = z.strictObject({
  challengeId: idSchema,
  credential: webAuthnAuthenticationCredentialSchema,
});
export const passkeyRegistrationRequestSchema = z.strictObject({
  challengeId: idSchema,
  credential: webAuthnRegistrationCredentialSchema,
  label: z.string().trim().min(1).max(60).optional(),
});
export const totpConfirmRequestSchema = z.strictObject({
  code: totpCodeSchema,
});

export const invitationCreateRequestSchema = z.strictObject({
  email: emailSchema,
  displayName: displayNameSchema,
});
export const accountDeactivateRequestSchema = z.strictObject({
  reason: reasonSchema,
});

export const accessRequestKindSchema = z.enum(['ROLE_GRANT', 'ROLE_REVOKE']);
export type AccessRequestKind = z.infer<typeof accessRequestKindSchema>;
export const accessRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
]);
export const accessRequestCreateRequestSchema = z.strictObject({
  kind: accessRequestKindSchema,
  targetAccountId: idSchema,
  targetRole: backofficeRoleSchema,
  reason: reasonSchema.optional(),
});
export const accessRequestApproveRequestSchema = z.strictObject({
  contentDigest: contentDigestSchema,
  // Required only for the single-approver exception (operator-access.md OA-R9).
  reason: reasonSchema.optional(),
});
export const accessRequestRejectRequestSchema = z.strictObject({
  contentDigest: contentDigestSchema,
  reason: reasonSchema,
});
export const accessRequestListQuerySchema = z.strictObject({
  status: accessRequestStatusSchema.optional(),
});

export const auditEventsQuerySchema = z.strictObject({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const auditReviewRequestSchema = z.strictObject({
  note: z.string().trim().min(1).max(500).optional(),
});

export type LoginPasswordRequest = z.infer<typeof loginPasswordRequestSchema>;
export type LoginPasskeyRequest = z.infer<typeof loginPasskeyRequestSchema>;
export type LoginTotpRequest = z.infer<typeof loginTotpRequestSchema>;
export type LoginRecoveryCodeRequest = z.infer<typeof loginRecoveryCodeRequestSchema>;
export type RegistrationOptionsRequest = z.infer<typeof registrationOptionsRequestSchema>;
export type RegistrationRequest = z.infer<typeof registrationRequestSchema>;
export type ReauthenticationRequest = z.infer<typeof reauthenticationRequestSchema>;
export type PasskeyRegistrationRequest = z.infer<typeof passkeyRegistrationRequestSchema>;
export type TotpConfirmRequest = z.infer<typeof totpConfirmRequestSchema>;
export type InvitationCreateRequest = z.infer<typeof invitationCreateRequestSchema>;
export type AccountDeactivateRequest = z.infer<typeof accountDeactivateRequestSchema>;
export type AccessRequestCreateRequest = z.infer<typeof accessRequestCreateRequestSchema>;
export type AccessRequestApproveRequest = z.infer<typeof accessRequestApproveRequestSchema>;
export type AccessRequestRejectRequest = z.infer<typeof accessRequestRejectRequestSchema>;
export type AccessRequestListQuery = z.infer<typeof accessRequestListQuerySchema>;
export type AuditEventsQuery = z.infer<typeof auditEventsQuerySchema>;
export type AuditReviewRequest = z.infer<typeof auditReviewRequestSchema>;

/** Error codes the backoffice API returns in `{ error: { code } }`. The BFF maps them to UI text. */
export const backofficeErrorCodeSchema = z.enum([
  'invalid_request',
  'authentication_failed',
  'session_required',
  'session_expired',
  'recovery_scope',
  'reauthentication_required',
  'permission_denied',
  'not_found',
  'conflict',
  'rate_limited',
  'internal_error',
]);
export type BackofficeErrorCode = z.infer<typeof backofficeErrorCodeSchema>;
