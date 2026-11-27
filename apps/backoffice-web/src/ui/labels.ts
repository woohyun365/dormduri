import type {
  AccessRequest,
  BackofficeRole,
  LegalDraftStatus,
  LegalPublicationRefusal,
  LegalRequestKind,
  LegalVersionState,
  LegalWithdrawalRefusal,
} from '@repo/shared/backoffice';
import type { LegalDocumentKind, LegalNoticeClass } from '@repo/shared/legal';

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
  LEGAL_DRAFT_CREATE: '법적 문서 초안 만들기',
  LEGAL_DRAFT_UPDATE: '법적 문서 초안 저장',
  LEGAL_DRAFT_DISCARD: '법적 문서 초안 버림',
  LEGAL_PUBLISH_REQUEST: '게시 요청',
  LEGAL_PUBLISH_APPROVE: '게시 승인',
  LEGAL_PUBLISH_REJECT: '게시 거절',
  LEGAL_WITHDRAW_REQUEST: '철회 요청',
  LEGAL_WITHDRAW_APPROVE: '철회 승인',
  LEGAL_WITHDRAW_REJECT: '철회 거절',
  LEGAL_REQUEST_CANCEL: '법적 문서 요청 취소',
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

// Short names of the target kinds the API writes (backoffice-api `targetType`) for the audit table; the detail keeps the
// code.
const AUDIT_TARGET_LABELS: Record<string, string> = {
  ADMIN_ACCOUNT: '계정',
  ADMIN_APPROVAL_REQUEST: '권한 요청',
  ADMIN_INVITATION: '초대',
  ADMIN_PASSKEY_CREDENTIAL: 'passkey',
  ADMIN_ROLE_ASSIGNMENT: '역할 배정',
  ADMIN_SESSION: '접속',
  LEGAL_DOCUMENT_DRAFT: '법적 문서 초안',
  LEGAL_DOCUMENT_VERSION: '법적 문서 판',
};

/** An audit row's target kind in a short Korean name; an unknown kind shows its code. */
export function auditTargetLabel(code: string): string {
  return AUDIT_TARGET_LABELS[code] ?? code;
}

// Public legal documents (backoffice-api README §8). The words follow the public screens and legal-basis LB-R6·LB-R10.
export const LEGAL_KIND_LABELS: Record<LegalDocumentKind, string> = {
  TERMS_OF_SERVICE: '이용약관',
  PRIVACY_POLICY: '개인정보 처리방침',
  PERSONAL_DATA_COLLECTION_USE_CONSENT: '개인정보 수집·이용 동의',
  AGE_14_OR_ABOVE_NOTICE: '만 14세 이상 확인',
};

/** Notice classes: the class sets the earliest effective date (LB-R10). */
export const LEGAL_NOTICE_CLASS_LABELS: Record<LegalNoticeClass, string> = {
  HISTORICAL: '이전 판 기록',
  INITIAL: '첫 게시',
  GENERAL: '일반(7일 공지)',
  SIGNIFICANT: '중대(30일 공지)',
};

export const LEGAL_DRAFT_STATUS_LABELS: Record<LegalDraftStatus, string> = {
  EDITING: '편집 중',
  PENDING_APPROVAL: '승인 대기',
  PUBLISHED: '게시됨',
  DISCARDED: '버림',
};

export const LEGAL_VERSION_STATE_LABELS: Record<LegalVersionState, string> = {
  scheduled: '시행 예정',
  current: '시행 중',
  previous: '이전 판',
  withdrawn: '철회',
};

export const LEGAL_REQUEST_KIND_LABELS: Record<LegalRequestKind, string> = {
  LEGAL_PUBLISH: '게시 요청',
  LEGAL_WITHDRAW: '철회 요청',
};

/** Why the decision checks refuse a request as of now (backoffice-api `legal-publication-policy.ts`). */
export const LEGAL_REFUSAL_LABELS: Record<
  LegalPublicationRefusal | LegalWithdrawalRefusal,
  string
> = {
  first_publication_exists:
    '이 문서는 이미 첫 게시가 있어 이전 판 기록이나 두 번째 첫 게시를 받지 않습니다.',
  first_publication_required: '첫 게시 전에는 일반·중대 판을 게시할 수 없습니다.',
  historical_not_before_approval: '이전 판 기록의 적용 끝은 승인일(KST) 전이어야 합니다.',
  historical_overlap: '다른 이전 판 기록과 적용기간이 겹칩니다.',
  initial_after_approval: '첫 게시의 시행일은 승인일(KST)과 같거나 앞이어야 합니다.',
  initial_not_after_history:
    '첫 게시의 시행일은 마지막 이전 판 기록의 적용 끝 다음 날이어야 합니다.',
  notice_too_short:
    '시행일이 공지 기간보다 이릅니다. 일반은 승인일 + 7일, 중대는 승인일 + 30일부터입니다.',
  scheduled_version_exists: '이 문서에 시행 예정 판이 이미 있습니다. 먼저 그 판을 철회하세요.',
  effective_date_taken: '같은 시행일의 판이 이미 있습니다.',
  members_exist: '메일을 받을 회원이 있어 중대 판과 재동의가 필요한 판은 지금 승인할 수 없습니다.',
  not_withdrawable: '이전 판 기록과 첫 게시는 철회할 수 없습니다.',
  already_withdrawn: '이미 철회한 판입니다.',
  already_in_effect: '시행이 시작된 판은 철회할 수 없습니다.',
};
