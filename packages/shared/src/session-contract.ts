import type { AuthenticatedSessionUser } from './user-contract.js';

export interface SessionResponse {
  authenticated: boolean;
  user?: AuthenticatedSessionUser;
}
