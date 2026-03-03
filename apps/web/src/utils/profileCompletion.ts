import { PROFILE_COMPLETION } from '@/constants/ui';
import type { UserProfile } from '@/types/profile';

export function getProfileCompletion(user: UserProfile) {
  const optionalFields = [
    user.messageToRoommate,
    user.additional.college,
    user.additional.grade,
    user.additional.mbti,
    user.additional.temperatureSensitivity,
  ];
  const filledOptional = optionalFields.filter(Boolean).length;
  const totalOptional = optionalFields.length;
  const percent = Math.round(
    PROFILE_COMPLETION.base + (filledOptional / totalOptional) * PROFILE_COMPLETION.optional,
  );
  return { percent, filledOptional, totalOptional, isComplete: filledOptional === totalOptional };
}
