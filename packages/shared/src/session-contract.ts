import type { UserProfileBridge } from './profile-contract.js';

export interface SessionResponse {
  authenticated: boolean;
  user?: UserProfileBridge;
}
