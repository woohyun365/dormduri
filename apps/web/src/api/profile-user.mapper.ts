import type { UserProfile } from '@/types/profile';

type ProfileUserSource = Pick<
  UserProfile,
  'id' | 'nickname' | 'gender' | 'campus' | 'dormitoryId' | 'lifestyle' | 'intro'
> &
  Partial<Pick<UserProfile, 'messageToRoommate' | 'additional'>>;

const EMPTY_ADDITIONAL: UserProfile['additional'] = {
  college: null,
  grade: null,
  mbti: null,
  birthYear: null,
};

/**
 * profile/main owner가 받은 season profile source를 Web `UserProfile` view model로 변환한다.
 * Auth session identity만으로 lifestyle/intro/dormitory 기본값을 생성하지 않도록 source에 profile fields를 요구한다.
 */
export function toProfileUserProfile(source: ProfileUserSource): UserProfile {
  return {
    id: source.id,
    nickname: source.nickname,
    gender: source.gender,
    campus: source.campus,
    dormitoryId: source.dormitoryId,
    lifestyle: source.lifestyle,
    intro: source.intro,
    messageToRoommate: source.messageToRoommate ?? null,
    additional: source.additional ?? EMPTY_ADDITIONAL,
  };
}
