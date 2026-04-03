import type { LifestyleData } from '@/types/lifestyle';
import type { UserProfile } from '@/types/profile';

type UserProfileSource = {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: UserProfile['campus'];
  dormitoryId: string | null;
  lifestyle: LifestyleData;
  intro: string;
};

export function toUserProfile(source: UserProfileSource): UserProfile {
  return {
    id: source.id,
    nickname: source.nickname,
    gender: source.gender,
    campus: source.campus,
    dormitoryId: source.dormitoryId,
    lifestyle: source.lifestyle,
    intro: source.intro,
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  };
}
