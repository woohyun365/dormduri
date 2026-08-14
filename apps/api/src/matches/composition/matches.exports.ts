import type { ModuleMetadata } from '@nestjs/common';
import { MATCH_ACTIVE_VIEW_PORT } from '../application/ports/match-active-view.port.js';
import { MATCH_BLOCK_SIDE_EFFECT_PORT } from '../application/ports/match-block-side-effect.port.js';
import { MATCH_HISTORY_MATERIALIZATION_PORT } from '../application/ports/match-history-materialization.port.js';
import { MATCH_LIFECYCLE_SWEEP_PORT } from '../application/ports/match-lifecycle-sweep.port.js';
import { MATCH_REQUEST_SEARCH_METADATA_READER_PORT } from '../application/ports/match-request-search-metadata-reader.port.js';
import { MATCH_SCORE_PROJECTION_PORT } from '../application/ports/match-score-projection.port.js';
import { MatchLifecycleModule } from '../lifecycle/match-lifecycle.module.js';
import { MatchOverviewQuery } from '../overview/match-overview.query.js';

export const MATCHES_EXPORTS = [
  MATCH_ACTIVE_VIEW_PORT,
  MATCH_LIFECYCLE_SWEEP_PORT,
  MATCH_HISTORY_MATERIALIZATION_PORT,
  MATCH_BLOCK_SIDE_EFFECT_PORT,
  MATCH_SCORE_PROJECTION_PORT,
  MATCH_REQUEST_SEARCH_METADATA_READER_PORT,
  MatchOverviewQuery,
  MatchLifecycleModule,
] satisfies NonNullable<ModuleMetadata['exports']>;
