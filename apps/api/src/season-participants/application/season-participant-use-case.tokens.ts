import type { SeasonParticipantPublicTargetOwner } from '../season-participant-public-target.owner.js';
import type { SeasonParticipantSourceOwner } from '../season-participant-source-owner.js';
import type { SeasonParticipantWriteOwner } from '../season-participant-write-owner.js';

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
