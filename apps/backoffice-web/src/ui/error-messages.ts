import type { BffErrorCode } from '@/bff/bff-errors';

const MESSAGES: Record<
  BffErrorCode | 'network_error' | 'body_too_large' | 'passkey_cancelled',
  string
> = {
  invalid_request: '입력값을 다시 확인하세요.',
  authentication_failed: '로그인 정보가 맞지 않거나 계정을 쓸 수 없습니다.',
  session_required: '다시 로그인하세요.',
  session_expired: '접속이 끝났습니다. 다시 로그인하세요.',
  recovery_scope: '복구 로그인으로는 새 passkey 등록과 로그아웃만 할 수 있습니다.',
  reauthentication_required: 'passkey로 다시 확인해야 합니다.',
  permission_denied: '이 작업을 할 권한이 없습니다.',
  not_found: '대상을 찾을 수 없습니다.',
  conflict: '이미 처리됐거나 지금 상태에서는 할 수 없는 작업입니다. 화면을 새로 고쳐 확인하세요.',
  rate_limited: '시도가 너무 많습니다. 잠시 뒤 다시 시도하세요.',
  internal_error: '처리하지 못했습니다. 잠시 뒤 다시 시도하세요.',
  forbidden_origin: '이 주소에서 보낸 요청은 받지 않습니다. 백오피스 창에서 다시 시도하세요.',
  unsupported_media_type: '요청 형식이 맞지 않습니다.',
  upstream_unavailable: '백오피스 API에 닿지 못했습니다. 잠시 뒤 다시 시도하세요.',
  upstream_invalid: '백오피스 API 응답을 읽지 못했습니다. 관리자에게 알리세요.',
  network_error: '네트워크 연결을 확인하세요. 포트 포워딩이 열려 있어야 합니다.',
  body_too_large: '보낼 내용이 64 KiB를 넘어 보내지 않았습니다. 본문을 줄인 뒤 다시 하세요.',
  passkey_cancelled: 'passkey 확인이 취소됐거나 이 기기에서 쓸 수 없습니다.',
};

export function errorMessage(code: keyof typeof MESSAGES): string {
  return MESSAGES[code];
}
