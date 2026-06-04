import type { SeasonParticipantPublicTargetOwner } from '../public-targets/registration-snapshot.query.js';
import type { SeasonParticipantSourceOwner } from '../participants/season-participant-source.policy.js';
import type { SeasonParticipantWriteOwner } from './season-participant-write-owner.js';

export const SEASON_PARTICIPANT_WRITE_OWNER = Symbol('SEASON_PARTICIPANT_WRITE_OWNER');

export const SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER = Symbol(
  'SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER',
);

export const SEASON_PARTICIPANT_SOURCE_OWNER = Symbol('SEASON_PARTICIPANT_SOURCE_OWNER');

export type SeasonParticipantUseCaseProvider =
  | typeof SEASON_PARTICIPANT_WRITE_OWNER
  | typeof SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER
  | typeof SEASON_PARTICIPANT_SOURCE_OWNER;

export type {
  SeasonParticipantPublicTargetOwner,
  SeasonParticipantSourceOwner,
  SeasonParticipantWriteOwner,
};
