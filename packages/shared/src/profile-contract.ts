import type { Campus } from './identity-contract.js';
import type { LifestyleData } from './lifestyle.js';

export interface UserProfileBridge {
  id: string;
  email: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
  lifestyle: LifestyleData;
  intro: string;
  dormitoryId: string | null;
}
