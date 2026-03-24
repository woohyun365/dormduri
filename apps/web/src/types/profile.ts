import type { LifestyleData } from './lifestyle';
import type { AdditionalProfile } from '@/types/additional-profile';

export type TabId = 'home' | 'list' | 'profile' | 'settings';

export type DormitoryId = string | null;

export type Campus = 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';

export interface UserProfile {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
  dormitoryId: DormitoryId;
  lifestyle: LifestyleData;
  intro: string;
  messageToRoommate: string | null;
  additional: AdditionalProfile;
}

export interface RoommateProfile {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
  dormitoryId: DormitoryId;
  lifestyle: LifestyleData;
  intro: string;
  messageToRoommate: string | null;
  additional: AdditionalProfile;
  matchScore: number;
}
