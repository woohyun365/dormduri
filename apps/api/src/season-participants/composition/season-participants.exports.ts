import { CurrentSeasonParticipationViewQuery } from '../application/current-season-participation-view.query.js';
import { SeasonParticipantsService } from '../application/season-participants.service.js';
import { CurrentSeasonParticipantContextGuard } from '../context/current-season-participant-context.guard.js';

export const SEASON_PARTICIPANTS_EXPORTS = [
  SeasonParticipantsService,
  CurrentSeasonParticipationViewQuery,
  CurrentSeasonParticipantContextGuard,
];
