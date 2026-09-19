import type { LifestyleData } from '@repo/shared/lifestyle';
import type { UserProfile } from '@/main/model/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';
import { getDormitoryDisplayFromSeasonOperations } from '@/main/model/dormitoryDisplay.adapter';

const EMPTY_LIFESTYLE: LifestyleData = {
  bedtime: null,
  wakeTime: null,
  sleepHabit: null,
  sleepEnvironment: null,
  screenUsage: null,
  noiseSensitivity: null,
  smokingBehavior: null,
  indoorEating: null,
  phoneBehavior: null,
  earphoneUsage: null,
  cleanLevel: null,
  drinkingFrequency: null,
  relationshipStyle: null,
  temperatureSensitivity: null,
  smokingTolerance: null,
  phoneTolerance: null,
  earphoneExpectation: null,
  sleepEnvPreference: null,
  screenTolerance: null,
  indoorEatingTolerance: null,
  cleanExpectation: null,
  drinkingTolerance: null,
};

export function toMainLegacyUserProfile(dashboard: HomeDashboardResponse): UserProfile {
  const { user, displayIdentity, academicIdentity } = dashboard.viewer.identity;
  const dormitoryId = dashboard.viewer.selection.dormitoryId;

  return {
    id: user.id,
    nickname: displayIdentity.nickname || user.nickname,
    gender: user.gender,
    campus: user.campus,
    dormitoryId,
    dormitory: getDormitoryDisplayFromSeasonOperations(
      dormitoryId,
      dashboard.season.operatedDormitories,
    ),
    lifestyle: { ...EMPTY_LIFESTYLE },
    intro: '',
    messageToRoommate: null,
    additional: {
      college: academicIdentity.collegeCode,
      grade: null,
      mbti: null,
      birthYear: academicIdentity.birthYear,
    },
  };
}
