import type {
  AccessRequest,
  AccountListResponse,
  AuditEvent,
  BackofficePermission,
  InvitationCreatedResponse,
  LoginPasswordResponse,
  RegistrationOptionsResponse,
  RoleCatalogResponse,
  SessionInfoResponse,
} from '@repo/shared/backoffice';
import type { ActiveSession } from '../../server/session';

// Story fixtures (design guide ⑨): fake values only, `@example.test` addresses and fixed UUIDs (public repository).

export const OWNER_ID = '00000000-0000-4000-8000-000000000001';
export const AUDITOR_ID = '00000000-0000-4000-8000-000000000002';
export const LOCKED_ID = '00000000-0000-4000-8000-000000000003';
export const LEAVER_ID = '00000000-0000-4000-8000-000000000004';
export const OWNER_EMAIL = 'owner@example.test';
/** What the login and registration stories type as a password and an invitation code. */
export const STORY_PASSWORD = 'story-password-0000';
export const STORY_INVITATION_CODE = 'story-invitation-code-0000';

const OWNER_PERMISSIONS: readonly BackofficePermission[] = [
  'admin:account:invite',
  'admin:account:deactivate',
  'admin:access:request',
  'admin:access:approve',
  'admin:audit:read',
  'admin:audit:review',
];

const ownerSession: SessionInfoResponse = {
  account: { id: OWNER_ID, email: OWNER_EMAIL, displayName: '시험 운영자' },
  scope: 'FULL',
  roles: ['OWNER'],
  permissions: [...OWNER_PERMISSIONS],
  idleExpiresAt: '2026-11-24T10:15:00+09:00',
  absoluteExpiresAt: '2026-11-24T18:00:00+09:00',
  reauthenticatedUntil: null,
  totpConfirmed: true,
  recoveryCodesRemaining: 10,
  passkeyCount: 2,
};

/** A session far from both limits, so the idle notice stays hidden. */
export const activeOwner: ActiveSession = {
  session: ownerSession,
  idleRemainingMs: 15 * 60 * 1000,
  absoluteRemainingMs: 8 * 60 * 60 * 1000,
};

export const activeAuditor: ActiveSession = {
  ...activeOwner,
  session: {
    ...ownerSession,
    account: { id: AUDITOR_ID, email: 'auditor@example.test', displayName: '감사 운영자' },
    roles: ['AUDITOR'],
    permissions: ['admin:audit:read'],
  },
};

export const accountList: AccountListResponse = {
  accounts: [
    {
      id: OWNER_ID,
      email: OWNER_EMAIL,
      displayName: '시험 운영자',
      status: 'ACTIVE',
      locked: false,
      roles: ['OWNER'],
      lastLoginAt: '2026-11-24T09:58:00+09:00',
      deactivatedAt: null,
      createdAt: '2026-11-01T10:00:00+09:00',
    },
    {
      id: AUDITOR_ID,
      email: 'auditor@example.test',
      displayName: '감사 운영자',
      status: 'ACTIVE',
      locked: false,
      roles: ['AUDITOR'],
      lastLoginAt: '2026-11-23T14:20:00+09:00',
      deactivatedAt: null,
      createdAt: '2026-11-02T10:00:00+09:00',
    },
    {
      id: LOCKED_ID,
      email: 'locked@example.test',
      displayName: '잠긴 운영자',
      status: 'ACTIVE',
      locked: true,
      roles: [],
      lastLoginAt: null,
      deactivatedAt: null,
      createdAt: '2026-11-10T10:00:00+09:00',
    },
    {
      id: LEAVER_ID,
      email: 'leaver@example.test',
      displayName: '퇴직 운영자',
      status: 'DEACTIVATED',
      locked: false,
      roles: [],
      lastLoginAt: '2026-11-05T11:00:00+09:00',
      deactivatedAt: '2026-11-20T17:00:00+09:00',
      createdAt: '2026-11-03T10:00:00+09:00',
    },
  ],
  invitations: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      kind: 'OPERATOR',
      email: 'invited@example.test',
      displayName: '초대한 운영자',
      expiresAt: '2026-11-25T10:00:00+09:00',
    },
  ],
};

export const roleCatalog: RoleCatalogResponse['roles'] = [
  { role: 'OWNER', permissions: [...OWNER_PERMISSIONS] },
  { role: 'AUDITOR', permissions: ['admin:audit:read'] },
  { role: 'LEGAL_EDITOR', permissions: ['admin:legal:edit'] },
  { role: 'LEGAL_APPROVER', permissions: ['admin:legal:approve'] },
];

const baseRequest: AccessRequest = {
  id: '00000000-0000-4000-8000-000000000201',
  kind: 'ROLE_GRANT',
  status: 'PENDING',
  contentDigest: '0'.repeat(64),
  targetAccountId: AUDITOR_ID,
  targetRole: 'AUDITOR',
  requestedByAccountId: OWNER_ID,
  requestReason: '월 감사 점검 담당',
  expiresAt: '2026-11-27T10:00:00+09:00',
  decidedByAccountId: null,
  closedAt: null,
  decisionReason: null,
  selfApproved: false,
  createdAt: '2026-11-24T09:30:00+09:00',
};

/** A pending request of the only approver (self approval with a reason) and one from another operator. */
export const pendingRequests: readonly AccessRequest[] = [
  baseRequest,
  {
    ...baseRequest,
    id: '00000000-0000-4000-8000-000000000202',
    kind: 'ROLE_REVOKE',
    targetAccountId: LOCKED_ID,
    targetRole: 'LEGAL_EDITOR',
    requestedByAccountId: AUDITOR_ID,
    requestReason: null,
    createdAt: '2026-11-24T08:10:00+09:00',
  },
];

export const pageCursor = {
  beforeTime: '2026-11-24T08:10:00+09:00',
  beforeId: '00000000-0000-4000-8000-000000000202',
};

const baseEvent: AuditEvent = {
  id: '00000000-0000-4000-8000-000000000301',
  occurredAt: '2026-11-24T09:40:00+09:00',
  actorType: 'ADMIN',
  actorAccountId: OWNER_ID,
  sessionId: '00000000-0000-4000-8000-000000000401',
  accessPath: 'BACKOFFICE_WEB',
  action: 'ACCESS_REQUEST_APPROVE',
  targetType: 'ADMIN_ACCESS_REQUEST',
  targetId: '00000000-0000-4000-8000-000000000201',
  approvalRequestId: '00000000-0000-4000-8000-000000000201',
  result: 'SUCCEEDED',
  selfApproved: true,
  reason: '승인 권한 운영자가 한 명뿐임',
  requestId: null,
  metadata: null,
};

export const auditEvents: readonly AuditEvent[] = [
  baseEvent,
  {
    ...baseEvent,
    id: '00000000-0000-4000-8000-000000000302',
    occurredAt: '2026-11-24T09:31:00+09:00',
    action: 'LOGIN',
    targetType: null,
    targetId: null,
    approvalRequestId: null,
    selfApproved: false,
    reason: null,
    metadata: { scope: 'FULL', method: 'passkey' },
  },
  {
    ...baseEvent,
    id: '00000000-0000-4000-8000-000000000303',
    occurredAt: '2026-11-24T09:20:00+09:00',
    actorType: 'ANONYMOUS',
    actorAccountId: null,
    sessionId: null,
    action: 'LOGIN',
    targetType: null,
    targetId: null,
    approvalRequestId: null,
    result: 'DENIED',
    selfApproved: false,
    reason: null,
  },
  {
    ...baseEvent,
    id: '00000000-0000-4000-8000-000000000304',
    occurredAt: '2026-11-24T09:00:00+09:00',
    actorType: 'SYSTEM',
    actorAccountId: null,
    action: 'NEW_ACTION_CODE',
    targetType: 'ADMIN_SESSION',
    targetId: '00000000-0000-4000-8000-000000000402',
    approvalRequestId: null,
    result: 'SUCCEEDED',
    selfApproved: false,
    reason: null,
  },
  // Recovery logins, named by their second factor in the action cell (design plan D-OD10 2).
  {
    ...baseEvent,
    id: '00000000-0000-4000-8000-000000000305',
    occurredAt: '2026-11-24T08:50:00+09:00',
    sessionId: '00000000-0000-4000-8000-000000000403',
    action: 'LOGIN',
    targetType: 'ADMIN_SESSION',
    targetId: '00000000-0000-4000-8000-000000000403',
    approvalRequestId: null,
    selfApproved: false,
    reason: null,
    metadata: { scope: 'RECOVERY', method: 'totp' },
  },
  {
    ...baseEvent,
    id: '00000000-0000-4000-8000-000000000306',
    occurredAt: '2026-11-24T08:40:00+09:00',
    sessionId: '00000000-0000-4000-8000-000000000404',
    action: 'LOGIN',
    targetType: 'ADMIN_SESSION',
    targetId: '00000000-0000-4000-8000-000000000404',
    approvalRequestId: null,
    selfApproved: false,
    reason: null,
    metadata: { scope: 'RECOVERY', method: 'recovery_code' },
  },
];

export const auditNames: Readonly<Record<string, string>> = {
  [OWNER_ID]: '시험 운영자',
  [AUDITOR_ID]: '감사 운영자',
};

/** Fake one-time values in the formats the screens show (TOTP secret, recovery codes). */
export const issuedTotp = {
  secret: 'ABCDEFGHIJKLMNOP2345',
  uri: 'otpauth://totp/dormduri:owner@example.test?secret=ABCDEFGHIJKLMNOP2345&issuer=dormduri',
};
export const recoveryCodes = [
  'AAAAA-BBBBB',
  'CCCCC-DDDDD',
  'EEEEE-FFFFF',
  'GGGGG-HHHHH',
  'IIIII-JJJJJ',
  'KKKKK-LLLLL',
  'MMMMM-NNNNN',
  'OOOOO-PPPPP',
  'QQQQQ-RRRRR',
  'SSSSS-TTTTT',
];

/** The password step's answer: the passkey challenge and the recovery logins the account can use. */
export const loginChallenge: LoginPasswordResponse = {
  challengeId: '00000000-0000-4000-8000-000000000401',
  options: { challenge: 'c3RvcnktbG9naW4tY2hhbGxlbmdl' },
  recovery: { totp: true, recoveryCode: true },
};

/** The invitation code's answer: the invited account and the passkey challenge. */
export const registrationInvitation: RegistrationOptionsResponse = {
  challengeId: '00000000-0000-4000-8000-000000000402',
  options: { challenge: 'c3RvcnktcmVnaXN0ZXItY2hhbGxlbmdl' },
  email: 'operator@example.test',
  displayName: '새 운영자',
};

/** The invite form's answer: the one-time code the owner hands over (shown once). */
export const invitationCreated: InvitationCreatedResponse = {
  invitationId: '00000000-0000-4000-8000-000000000403',
  code: 'STORY-INVITATION-CODE-0000',
  expiresAt: '2026-11-24T10:15:00+09:00',
};
