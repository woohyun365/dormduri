import type { LifestyleData } from '@repo/shared/lifestyle';
import type { MatchActiveViewPort } from '../../matches/application/ports/match-active-view.port.js';
import type {
  CurrentSeasonParticipantRecord,
  CurrentSeasonParticipantProfileRecord,
} from '../../season-participants/participants/season-participant-records.js';
import type { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import type { resolvePublicTargetPolicy } from '../../season-participants/public-target-policy/index.js';
import type { ProfileViewRecord } from '../contracts/public-profile.presenter.js';

export interface PublicProfileViewerContext {
  viewer: {
    id: string;
    emailVerifiedAt: Date | null;
    gender: 'M' | 'F';
    campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  };
  viewerParticipant: CurrentSeasonParticipantRecord | null;
  viewerSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
  viewerLifestyle: LifestyleData | null;
  viewerSeasonProfileComplete: boolean;
  viewerHasOperatedAssignedDormitory: boolean;
  currentSeasonId: string | null;
  seasonReferenceYear: number | null;
  serviceState: {
    campusOperated: boolean;
    seasonState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null;
  };
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
}

export interface PublicProfileTargetCandidate {
  user: {
    id: string;
    deletedAt: Date | null;
  };
  participant: CurrentSeasonParticipantRecord;
}

export interface ResolvedPublicProfileEntry {
  user: PublicProfileTargetCandidate['user'];
  targetParticipant: CurrentSeasonParticipantRecord;
  targetDormitoryId: string | null;
  sourceProfile: ProfileViewRecord;
  publicTargetPolicy: ReturnType<typeof resolvePublicTargetPolicy>;
  matchScore: number | null;
  viewerMatched: boolean;
  targetMatched: boolean;
}

export type VisibleProfileViewerContext = PublicProfileViewerContext;
export type VisibleProfileTargetCandidate = PublicProfileTargetCandidate;
export type ResolvedVisibleProfileEntry = ResolvedPublicProfileEntry;

export type ActiveMatchByParticipantId = Awaited<
  ReturnType<MatchActiveViewPort['getCurrentActiveMatchByParticipantId']>
>;
export type ActiveMatchByParticipantIdMap = Map<string, ActiveMatchByParticipantId>;

export type TargetParticipantQueryRecord = CurrentSeasonParticipantRecord & {
  user: { id: string; deletedAt: Date | null };
};

export type ProfileTargetProfileRecord = CurrentSeasonParticipantProfileRecord;
