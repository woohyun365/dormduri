import type { PublicProfile } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type {
  PublicProfileTargetCandidate,
  PublicProfileViewerContext,
  ResolvedPublicProfileEntry,
  TargetParticipantQueryRecord,
} from '../targets/public-profile-target.types.js';

export const PROFILE_PUBLIC_TARGET_READER_PORT = Symbol('PROFILE_PUBLIC_TARGET_READER_PORT');

export interface ProfilePublicTargetReaderPort {
  loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
  ): Promise<PublicProfileViewerContext>;
  materializeVisibleProfileEntries(
    viewerContext: PublicProfileViewerContext,
    candidates: PublicProfileTargetCandidate[],
  ): Promise<ResolvedPublicProfileEntry[]>;
  mapTargetParticipantCandidate(record: TargetParticipantQueryRecord): PublicProfileTargetCandidate;
  getResolvedProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<ResolvedPublicProfileEntry | null>;
  getDetailProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
    options?: { detailEntryToken?: string },
  ): Promise<PublicProfile | null>;
}
