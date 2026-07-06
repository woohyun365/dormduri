export type RoommateApiErrorCode =
  | 'ROOMMATE_SEARCH_NETWORK_ERROR'
  | 'ROOMMATE_SEARCH_SCHEMA_INVALID'
  | 'ROOMMATE_ACTION_NETWORK_ERROR'
  | 'ROOMMATE_ACTION_SCHEMA_INVALID'
  | 'ROOMMATE_PROFILE_DETAIL_NETWORK_ERROR'
  | 'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID'
  | 'ROOMMATE_PROFILE_DETAIL_ENTRY_REQUIRED'
  | 'PROFILE_NOT_VISIBLE'
  | 'INVALID_ROOMMATE_SEARCH_QUERY'
  | 'BFF_UPSTREAM_SCHEMA_INVALID'
  | 'BFF_UPSTREAM_UNAVAILABLE'
  | 'BFF_UPSTREAM_NON_JSON_RESPONSE'
  | 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE'
  | 'BFF_UPSTREAM_URL_INVALID'
  | 'UNKNOWN_ROOMMATE_SEARCH_ERROR'
  | 'UNKNOWN_ROOMMATE_ACTION_ERROR'
  | 'UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR';

export interface RoommateApiError {
  readonly code: RoommateApiErrorCode;
  readonly status?: number;
  readonly message: string;
  readonly retryable: boolean;
}

const ROOMMATE_API_ERROR_MARKER = Symbol('RoommateApiError');

const SAFE_ERROR_MESSAGES: Record<RoommateApiErrorCode, string> = {
  ROOMMATE_SEARCH_NETWORK_ERROR:
    '룸메이트 찾기 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  ROOMMATE_SEARCH_SCHEMA_INVALID:
    '룸메이트 찾기 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  ROOMMATE_ACTION_NETWORK_ERROR:
    '룸메이트 관심 목록 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
  ROOMMATE_ACTION_SCHEMA_INVALID:
    '룸메이트 관심 목록 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  ROOMMATE_PROFILE_DETAIL_NETWORK_ERROR:
    '상세 정보를 다시 확인할 수 없어요. 잠시 후 다시 시도해 주세요.',
  ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID:
    '상세 정보 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  ROOMMATE_PROFILE_DETAIL_ENTRY_REQUIRED:
    '정상 목록 진입 맥락을 확인할 수 없어 상세 정보를 열지 않았어요.',
  PROFILE_NOT_VISIBLE: '상세 정보를 다시 확인할 수 없어요.',
  INVALID_ROOMMATE_SEARCH_QUERY: '검색 조건이 최신 룸메이트 찾기 정책과 맞지 않아요.',
  BFF_UPSTREAM_SCHEMA_INVALID: '룸메이트 찾기 응답 형식이 올바르지 않아요.',
  BFF_UPSTREAM_UNAVAILABLE: '룸메이트 찾기 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  BFF_UPSTREAM_NON_JSON_RESPONSE: '룸메이트 찾기 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
  BFF_UPSTREAM_MALFORMED_JSON_RESPONSE:
    '룸메이트 찾기 응답을 해석하지 못했어요. 잠시 후 다시 시도해 주세요.',
  BFF_UPSTREAM_URL_INVALID: '룸메이트 찾기 요청 경로가 올바르지 않아요.',
  UNKNOWN_ROOMMATE_SEARCH_ERROR:
    '룸메이트 찾기 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
  UNKNOWN_ROOMMATE_ACTION_ERROR:
    '룸메이트 관심 목록 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
  UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR:
    '상세 정보 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const RETRYABLE_ERROR_CODES = new Set<RoommateApiErrorCode>([
  'ROOMMATE_SEARCH_NETWORK_ERROR',
  'ROOMMATE_SEARCH_SCHEMA_INVALID',
  'ROOMMATE_ACTION_NETWORK_ERROR',
  'ROOMMATE_ACTION_SCHEMA_INVALID',
  'ROOMMATE_PROFILE_DETAIL_NETWORK_ERROR',
  'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID',
  'BFF_UPSTREAM_SCHEMA_INVALID',
  'BFF_UPSTREAM_UNAVAILABLE',
  'BFF_UPSTREAM_NON_JSON_RESPONSE',
  'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE',
  'UNKNOWN_ROOMMATE_SEARCH_ERROR',
  'UNKNOWN_ROOMMATE_ACTION_ERROR',
  'UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR',
]);

const KNOWN_ERROR_CODES = new Set<RoommateApiErrorCode>(
  Object.keys(SAFE_ERROR_MESSAGES) as RoommateApiErrorCode[],
);

export class RoommateApiRequestError extends Error implements RoommateApiError {
  readonly [ROOMMATE_API_ERROR_MARKER] = true;
  readonly code: RoommateApiErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(input: { code: RoommateApiErrorCode; status?: number }) {
    super(SAFE_ERROR_MESSAGES[input.code]);
    this.name = 'RoommateApiRequestError';
    this.code = input.code;
    this.status = input.status;
    this.retryable = RETRYABLE_ERROR_CODES.has(input.code);
  }
}

export function isRoommateApiError(error: unknown): error is RoommateApiRequestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ROOMMATE_API_ERROR_MARKER in error &&
    (error as { [ROOMMATE_API_ERROR_MARKER]?: unknown })[ROOMMATE_API_ERROR_MARKER] === true
  );
}

export function normalizeRoommateApiErrorCode(
  input: unknown,
  fallback: RoommateApiErrorCode = 'UNKNOWN_ROOMMATE_SEARCH_ERROR',
): RoommateApiErrorCode {
  if (typeof input === 'string' && KNOWN_ERROR_CODES.has(input as RoommateApiErrorCode)) {
    return input as RoommateApiErrorCode;
  }
  return fallback;
}

export function createRoommateApiError(input: {
  code: RoommateApiErrorCode;
  status?: number;
}): RoommateApiRequestError {
  return new RoommateApiRequestError(input);
}
