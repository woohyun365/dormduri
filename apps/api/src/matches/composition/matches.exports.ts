import type { ModuleMetadata } from '@nestjs/common';
import { MATCH_ACTIVE_VIEW_PORT } from '../application/ports/match-active-view.port.js';
import { MATCH_BLOCK_SIDE_EFFECT_PORT } from '../application/ports/match-block-side-effect.port.js';
import { MATCH_HISTORY_MATERIALIZATION_PORT } from '../application/ports/match-history-materialization.port.js';
import { MATCH_LIFECYCLE_SWEEP_PORT } from '../application/ports/match-lifecycle-sweep.port.js';
import { MatchesService } from '../matches.service.js';

export const MATCHES_EXPORTS = [
  MATCH_ACTIVE_VIEW_PORT,
  MATCH_LIFECYCLE_SWEEP_PORT,
  MATCH_HISTORY_MATERIALIZATION_PORT,
  MATCH_BLOCK_SIDE_EFFECT_PORT,
  // Temporary transition export until profiles/current-user/lifecycle migrate to match ports.
  MatchesService,
] satisfies NonNullable<ModuleMetadata['exports']>;
