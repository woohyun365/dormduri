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
  WebAuthnChallengeResponse,
  WebAuthnOptions,
} from '@repo/shared/backoffice';
import type { ActiveSession } from '../../server/session';

// Story fixtures (design guide ⑨): fake values only, `@example.test` addresses and fixed UUIDs (public repository).

// Account ids differ in their first eight characters: an operator without the owner role reads short ids, not names.
export const OWNER_ID = '1a7c3e90-0000-4000-8000-000000000001';
export const AUDITOR_ID = '2b8d4fa1-0000-4000-8000-000000000002';
export const LOCKED_ID = '3c9e50b2-0000-4000-8000-000000000003';
export const LEAVER_ID = '4daf61c3-0000-4000-8000-000000000004';
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

/** The owner without a confirmed TOTP and without recovery codes: the home and the security screen warn. */
export const ownerWithoutRecovery: SessionInfoResponse = {
  ...ownerSession,
  totpConfirmed: false,
  recoveryCodesRemaining: 0,
  reauthenticatedUntil: '2026-11-24T10:05:00+09:00',
};

export const activeOwnerWithoutRecovery: ActiveSession = {
  ...activeOwner,
  session: ownerWithoutRecovery,
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

const LONG_ID = '5eb072d4-0000-4000-8000-000000000005';

/** The four accounts plus one with a long Korean name and a long address (D-OD14 line breaks). */
export const longAccountList: AccountListResponse = {
  ...accountList,
  accounts: [
    ...accountList.accounts.slice(0, 2),
    {
      id: LONG_ID,
      email: 'legal-document-approver.second-campus@example.test',
      displayName: '법적문서승인담당운영자한빛나래',
      status: 'ACTIVE',
      locked: false,
      roles: ['LEGAL_EDITOR', 'LEGAL_APPROVER'],
      lastLoginAt: '2026-11-22T18:05:00+09:00',
      deactivatedAt: null,
      createdAt: '2026-11-04T10:00:00+09:00',
    },
    ...accountList.accounts.slice(2),
  ],
};

const ROW_ROLES = [['AUDITOR'], ['LEGAL_EDITOR'], ['LEGAL_APPROVER'], []] as const;

/** Fifty rows for the row height. */
export const manyAccountList: AccountListResponse = {
  accounts: Array.from({ length: 50 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    const deactivated = index % 9 === 8;
    return {
      id: `00000000-0000-4000-8000-0000000011${n}`,
      email: `operator-${n}@example.test`,
      displayName: `시험 운영자 ${n}`,
      status: deactivated ? ('DEACTIVATED' as const) : ('ACTIVE' as const),
      locked: index % 11 === 10,
      roles: [...ROW_ROLES[index % ROW_ROLES.length]!],
      lastLoginAt: `2026-11-${String(24 - (index % 20)).padStart(2, '0')}T09:${n}:00+09:00`,
      deactivatedAt: deactivated ? '2026-11-20T17:00:00+09:00' : null,
      createdAt: '2026-11-01T10:00:00+09:00',
    };
  }),
  invitations: accountList.invitations,
};

export const roleCatalog: RoleCatalogResponse['roles'] = [
  { role: 'OWNER', permissions: [...OWNER_PERMISSIONS] },
  { role: 'AUDITOR', permissions: ['admin:audit:read'] },
  { role: 'LEGAL_EDITOR', permissions: ['admin:legal:edit'] },
  { role: 'LEGAL_APPROVER', permissions: ['admin:legal:approve'] },
];

// Request ids differ in their first eight characters: a detail shows the short id, so the shared 00000000 head would read
// the same on every request.
const REQUEST_IDS = [
  '3f8a61c2-0b4d-4e71-9a5c-2d6e7f801201',
  'c47d29e0-6a13-4b58-8f2e-91ab3c4d5202',
  'e1b6d83f-2c57-4a09-b4e8-5f7a9c0d6203',
  'f62c0a94-7d38-4e1b-a5f6-0c8b2e1d7204',
] as const;

const baseRequest: AccessRequest = {
  id: REQUEST_IDS[0],
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
    id: REQUEST_IDS[1],
    kind: 'ROLE_REVOKE',
    targetAccountId: LOCKED_ID,
    targetRole: 'LEGAL_EDITOR',
    requestedByAccountId: AUDITOR_ID,
    requestReason: null,
    createdAt: '2026-11-24T08:10:00+09:00',
  },
];

/** Decided requests: the only approver's own grant approved with a reason, and another operator's grant rejected. */
export const decidedRequests: readonly AccessRequest[] = [
  {
    ...baseRequest,
    id: REQUEST_IDS[2],
    status: 'APPROVED',
    targetAccountId: OWNER_ID,
    targetRole: 'LEGAL_APPROVER',
    decidedByAccountId: OWNER_ID,
    closedAt: '2026-11-24T09:58:12+09:00',
    decisionReason: '승인 권한 운영자가 한 명뿐임',
    selfApproved: true,
    createdAt: '2026-11-24T09:40:00+09:00',
  },
  {
    ...baseRequest,
    id: REQUEST_IDS[3],
    status: 'REJECTED',
    targetAccountId: LOCKED_ID,
    targetRole: 'OWNER',
    requestedByAccountId: AUDITOR_ID,
    requestReason: '계정 관리 보조',
    decidedByAccountId: OWNER_ID,
    closedAt: '2026-11-24T09:12:00+09:00',
    decisionReason: '업무 범위 밖 요청',
    createdAt: '2026-11-24T08:55:00+09:00',
  },
];

export const pageCursor = {
  beforeTime: '2026-11-24T08:10:00+09:00',
  beforeId: REQUEST_IDS[1],
};

// Audit actors with distinct fake ids: an auditor (who reads short ids, not names) would see every 00000000 actor as the
// same.
const ACTOR = {
  owner: 'a3f1c9e2-5b7d-4e08-9c1a-2f6b8d4e0101',
  auditor: 'b7d204aa-1c3e-4f59-8a2b-6c9e0d1f0202',
  long: 'c58e3b71-9d2a-4c64-b1f0-7e3a5c2d0303',
  leaver: 'd94a6f20-3e8b-4a17-9c5d-1b2f6e8a0404',
} as const;

/** Names an owner reads (an auditor without the owner role reads short ids). */
export const auditNames: Readonly<Record<string, string>> = {
  [ACTOR.owner]: '시험 운영자',
  [ACTOR.auditor]: '감사 운영자',
  [ACTOR.long]: '법적문서승인담당운영자한빛나래',
  [ACTOR.leaver]: '퇴직 운영자',
};

const uuid = (head: string, n: number) =>
  `${head}${String(n).padStart(8 - head.length, '0')}-2c4e-4d1a-8f3b-6a7c${String(n).padStart(8, '0')}`;

const event = (
  n: number,
  occurredAt: string,
  fields: Partial<AuditEvent> & Pick<AuditEvent, 'action'>,
): AuditEvent => ({
  id: uuid('9b', n),
  occurredAt,
  actorType: 'ADMIN',
  actorAccountId: ACTOR.owner,
  sessionId: uuid('5e', 1),
  accessPath: 'SSM_PORT_FORWARD',
  targetType: null,
  targetId: null,
  approvalRequestId: null,
  result: 'SUCCEEDED',
  selfApproved: false,
  reason: null,
  requestId: uuid('7a', n),
  metadata: null,
  ...fields,
});

const login = (n: number, occurredAt: string, actor: string, scope: string, method: string) =>
  event(n, occurredAt, {
    action: 'LOGIN',
    actorAccountId: actor,
    sessionId: uuid('5e', n),
    targetType: 'ADMIN_SESSION',
    targetId: uuid('5e', n),
    metadata: { scope, method },
  });

/** Ten rows: a self approval, two recovery logins, a denied login, an unknown code and the monthly review. */
export const auditEvents: readonly AuditEvent[] = [
  event(1, '2026-11-24T09:58:12+09:00', {
    action: 'ACCESS_REQUEST_APPROVE',
    targetType: 'ADMIN_APPROVAL_REQUEST',
    targetId: REQUEST_IDS[2],
    approvalRequestId: REQUEST_IDS[2],
    selfApproved: true,
    reason: '승인 권한 운영자가 한 명뿐임',
  }),
  login(2, '2026-11-24T09:52:40+09:00', ACTOR.auditor, 'RECOVERY', 'totp'),
  login(3, '2026-11-24T09:47:05+09:00', ACTOR.long, 'RECOVERY', 'recovery_code'),
  login(4, '2026-11-24T09:31:00+09:00', ACTOR.owner, 'FULL', 'passkey'),
  event(5, '2026-11-24T09:20:33+09:00', {
    action: 'LOGIN',
    actorType: 'ANONYMOUS',
    actorAccountId: null,
    sessionId: null,
    result: 'DENIED',
  }),
  event(6, '2026-11-24T09:10:30+09:00', {
    action: 'ACCOUNT_DEACTIVATE',
    targetType: 'ADMIN_ACCOUNT',
    targetId: ACTOR.leaver,
    reason: '퇴직으로 업무 종료',
  }),
  event(7, '2026-11-24T09:05:00+09:00', {
    action: 'AUDIT_REVIEW',
    actorAccountId: ACTOR.auditor,
    reason: '11월 대조 결과 차이 없음',
    metadata: { checked: 'admin_audit_and_ssm_session_trail' },
  }),
  event(8, '2026-11-24T09:00:00+09:00', {
    action: 'NEW_ACTION_CODE',
    actorType: 'SYSTEM',
    actorAccountId: null,
    sessionId: null,
    targetType: 'ADMIN_SESSION',
    targetId: uuid('5e', 8),
  }),
  event(9, '2026-11-24T08:45:10+09:00', { action: 'PASSKEY_REGISTER', result: 'FAILED' }),
  event(10, '2026-11-24T08:30:00+09:00', {
    action: 'INVITATION_CREATE',
    targetType: 'ADMIN_INVITATION',
    targetId: uuid('1c', 10),
  }),
];

/** The auditor's recovery login with TOTP, the row a detail story opens. */
export const recoveryLoginEvent = auditEvents[1]!;

const ACTIONS = ['LOGIN', 'REAUTHENTICATE', 'LOGOUT', 'SESSION_EXPIRED'] as const;

/** Fifty rows, a full first page, for the row height. */
export const manyAuditEvents: readonly AuditEvent[] = Array.from({ length: 50 }, (_, index) => {
  const at = new Date(
    Date.parse('2026-11-24T09:58:00+09:00') - index * 7 * 60_000 - index * 13_000,
  );
  const action = ACTIONS[index % ACTIONS.length]!;
  return event(100 + index, at.toISOString(), {
    action,
    actorAccountId: index % 3 === 2 ? ACTOR.auditor : ACTOR.owner,
    metadata: action === 'LOGIN' ? { scope: 'FULL', method: 'passkey' } : null,
  });
});

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

/**
 * Passkey creation options with the fields the browser library reads before it calls `navigator.credentials.create`
 * (a story answers that call with passkey-stub.ts).
 */
const creationOptions: WebAuthnOptions = {
  challenge: 'c3RvcnktcmVnaXN0ZXItY2hhbGxlbmdl',
  rp: { name: 'dormduri backoffice', id: 'localhost' },
  user: { id: 'c3RvcnktdXNlcg', name: 'operator@example.test', displayName: '새 운영자' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
};

/** The invitation code's answer: the invited account and the passkey challenge. */
export const registrationInvitation: RegistrationOptionsResponse = {
  challengeId: '00000000-0000-4000-8000-000000000402',
  options: creationOptions,
  email: 'operator@example.test',
  displayName: '새 운영자',
};

/** The invite form's answer: the one-time code the owner hands over (shown once). */
export const invitationCreated: InvitationCreatedResponse = {
  invitationId: '00000000-0000-4000-8000-000000000403',
  code: 'STORY-INVITATION-CODE-0000',
  expiresAt: '2026-11-24T10:15:00+09:00',
};

/** A new passkey's options (the security and recovery screens). */
export const passkeyOptions: WebAuthnChallengeResponse = {
  challengeId: '00000000-0000-4000-8000-000000000404',
  options: creationOptions,
};
