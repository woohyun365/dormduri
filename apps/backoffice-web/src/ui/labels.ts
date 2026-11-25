import type { AccessRequest, BackofficeRole } from '@repo/shared/backoffice';

export const ROLE_LABELS: Record<BackofficeRole, string> = {
  OWNER: '소유자(owner)',
  AUDITOR: '감사 열람(auditor)',
  LEGAL_EDITOR: '법적 문서 편집(legal-editor)',
  LEGAL_APPROVER: '법적 문서 승인(legal-approver)',
};

export const REQUEST_KIND_LABELS: Record<AccessRequest['kind'], string> = {
  ROLE_GRANT: '역할 부여',
  ROLE_REVOKE: '역할 회수',
};

export const REQUEST_STATUS_LABELS: Record<AccessRequest['status'], string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '거절',
  CANCELLED: '취소',
  EXPIRED: '만료',
};

// Audit codes the screen knows by name; an unknown code is shown as it is (responses.ts).
const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
  SESSION_EXPIRED: 'session 만료',
  ACCOUNT_LOCKED: '계정 잠금',
  REAUTHENTICATE: '재인증',
  PASSKEY_REGISTER: 'passkey 등록',
  TOTP_ENROLL: 'TOTP 등록',
  RECOVERY_CODES_ISSUE: '복구 code 발급',
  INVITATION_CREATE: '초대 생성',
  INVITATION_REVOKE: '초대 취소',
  INVITATION_ACCEPT: '초대 등록',
  ACCESS_REQUEST_CREATE: '권한 요청',
  ACCESS_REQUEST_APPROVE: '권한 요청 승인',
  ACCESS_REQUEST_REJECT: '권한 요청 거절',
  ACCESS_REQUEST_CANCEL: '권한 요청 취소',
  ROLE_GRANT: '역할 부여',
  ROLE_REVOKE: '역할 회수',
  ACCOUNT_DEACTIVATE: '계정 비활성화',
  AUDIT_REVIEW: '월 점검 기록',
  BOOTSTRAP_OWNER: '첫 owner 발급',
};

/** A LOGIN row whose session is a recovery session, by its second factor (audit-display.ts). */
export const RECOVERY_LOGIN_LABELS: Record<'totp' | 'recovery_code', string> = {
  totp: '복구 로그인(TOTP)',
  recovery_code: '복구 로그인(복구 code)',
};

const AUDIT_RESULT_LABELS: Record<string, string> = {
  SUCCEEDED: '성공',
  DENIED: '거부',
  FAILED: '실패',
};

const AUDIT_ACTOR_LABELS: Record<string, string> = {
  ADMIN: '운영자',
  SYSTEM: 'system',
  ANONYMOUS: '익명',
};

export function auditActionLabel(code: string): string {
  return AUDIT_ACTION_LABELS[code] ?? code;
}

export function auditResultLabel(code: string): string {
  return AUDIT_RESULT_LABELS[code] ?? code;
}

export function auditActorLabel(code: string): string {
  return AUDIT_ACTOR_LABELS[code] ?? code;
}

// Short names of the target kinds the audit table shows; the detail keeps the code.
const AUDIT_TARGET_LABELS: Record<string, string> = {
  ADMIN_ACCESS_REQUEST: '권한 요청',
  ADMIN_SESSION: '접속',
  ADMIN_ACCOUNT: '계정',
  ADMIN_INVITATION: '초대',
};

/** An audit row's target kind in a short Korean name; an unknown kind shows its code. */
export function auditTargetLabel(code: string): string {
  return AUDIT_TARGET_LABELS[code] ?? code;
}
