import type { Campus } from '@repo/shared/auth';

const CAMPUS_MATCHING_COPY: Record<Campus, string> = {
  CHUNCHEON: '춘천캠퍼스 생활관 기준으로 매칭해요.',
  SAMCHEOK: '삼척캠퍼스 생활관 기준으로 매칭해요.',
  DOGYE: '도계캠퍼스 생활관 기준으로 매칭해요.',
};

export const SIGNUP_ACADEMIC_COPY = {
  immutableIdentity: '캠퍼스·성별은 가입 후 변경할 수 없어요.',
  campusUnselected: '캠퍼스를 선택하면 해당 생활관 기준으로 매칭해요.',
  collegeCatalogUnavailable:
    '선택한 캠퍼스의 단과대 정보를 불러오지 못했어요. 캠퍼스를 다시 선택해주세요.',
} as const;

export function getSignupCampusMatchingCopy(campus: Campus) {
  return CAMPUS_MATCHING_COPY[campus];
}
