import type { ModuleMetadata } from '@nestjs/common';
import { ActiveMatchContextGuard } from '../active/context/active-match-context.guard.js';
import { ActiveMatchViewQuery } from '../active/queries/active-match-view.query.js';
import { MATCH_ACTIVE_VIEW_PORT } from '../application/ports/match-active-view.port.js';
import { MATCH_BLOCK_SIDE_EFFECT_PORT } from '../application/ports/match-block-side-effect.port.js';
import { MATCH_HISTORY_MATERIALIZATION_PORT } from '../application/ports/match-history-materialization.port.js';
import { MATCH_LIFECYCLE_SWEEP_PORT } from '../application/ports/match-lifecycle-sweep.port.js';
import { MatchBlockSideEffectService } from '../lifecycle/match-block-side-effect.service.js';
import { MatchesService } from '../matches.service.js';

export const MATCHES_PROVIDERS = [
  MatchesService,
  ActiveMatchContextGuard,
  ActiveMatchViewQuery,
  MatchBlockSideEffectService,
  {
    provide: MATCH_ACTIVE_VIEW_PORT,
    useExisting: ActiveMatchViewQuery,
  },
  {
    provide: MATCH_LIFECYCLE_SWEEP_PORT,
    useExisting: MatchesService,
  },
  {
    provide: MATCH_HISTORY_MATERIALIZATION_PORT,
    useExisting: MatchesService,
  },
  {
    provide: MATCH_BLOCK_SIDE_EFFECT_PORT,
    useExisting: MatchBlockSideEffectService,
  },
] satisfies NonNullable<ModuleMetadata['providers']>;
