import type { DormitoryPublicSummary } from '@repo/shared/dormitory';
import type { Campus, Gender } from '@repo/shared/identity/primitives';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { PublicProfileAdditional } from '@repo/shared/profile/contract';

export interface UserProfile {
  readonly id: string;
  readonly nickname: string;
  readonly gender: Gender;
  readonly campus: Campus;
  readonly dormitoryId: string | null;
  readonly dormitory?: DormitoryPublicSummary | null;
  readonly lifestyle: LifestyleData;
  readonly intro: string;
  readonly messageToRoommate: string | null;
  readonly additional: PublicProfileAdditional;
}

export interface RoommateProfile extends UserProfile {
  readonly matchScore: number;
}
