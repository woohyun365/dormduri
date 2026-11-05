import type { Campus, Gender } from '@repo/database/enums';
import type { AuthCapability } from '../access/auth-capability.js';

export interface AuthenticatedUserContext {
  id: string;
  sessionId?: string;
  gender: Gender;
  campus: Campus;
  actorType?: 'USER';
  actorId?: string;
  capabilities?: readonly AuthCapability[];
}

export interface ResolvedAuthActorContext extends AuthenticatedUserContext {
  sessionId: string;
  actorType: 'USER';
  actorId: string;
  capabilities: readonly AuthCapability[];
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  authUser?: ResolvedAuthActorContext;
}
