import { CORE_LIFESTYLE_FIELDS, type LifestyleData } from '@repo/shared/lifestyle';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { AdditionalProfile } from '@repo/shared/profile-contract';

const OPTIONAL_PROFILE_KEYS: Array<keyof AdditionalProfile> = [
  'college',
  'grade',
  'mbti',
  'birthYear',
];

export function buildUserReadiness(input: {
  lifestyle: LifestyleData;
  intro: string;
  messageToRoommate: string | null;
  additional: AdditionalProfile;
  selectionState: DormitorySelectionState;
  canBrowseProfiles: boolean;
}): CurrentUserResponse['readiness'] {
  const requiredCompletedCount =
    CORE_LIFESTYLE_FIELDS.filter((field) => input.lifestyle[field] !== null).length +
    (input.intro.trim().length > 0 ? 1 : 0);
  const optionalCompletedCount =
    (input.messageToRoommate?.trim().length ? 1 : 0) +
    OPTIONAL_PROFILE_KEYS.filter((field) => input.additional[field] !== null).length;

  const requiredTotalCount = CORE_LIFESTYLE_FIELDS.length + 1;
  const optionalTotalCount = OPTIONAL_PROFILE_KEYS.length + 1;

  return {
    requiredCompletedCount,
    requiredTotalCount,
    requiredComplete: requiredCompletedCount === requiredTotalCount,
    optionalCompletedCount,
    optionalTotalCount,
    optionalComplete: optionalCompletedCount === optionalTotalCount,
    selectionState: input.selectionState,
    canBrowseProfiles: input.canBrowseProfiles,
  };
}
