import type { ModuleMetadata } from '@nestjs/common';
import { CancelUnmatchRequestCommand } from '../active/commands/cancel-unmatch-request.command.js';
import { RequestUnmatchCommand } from '../active/commands/request-unmatch.command.js';
import { ActiveMatchContextGuard } from '../active/context/active-match-context.guard.js';
import { ActiveMatchLifecycleEventRepository } from '../active/lifecycle-events/active-match-lifecycle-event.repository.js';
import { ActiveMatchLifecycleEventWriter } from '../active/lifecycle-events/active-match-lifecycle-event.writer.js';
import { ActiveMatchLifecycleSweepService } from '../active/lifecycle/active-match-lifecycle-sweep.service.js';
import { ActiveMatchRepository } from '../active/persistence/active-match.repository.js';
import { ActiveMatchViewQuery } from '../active/queries/active-match-view.query.js';
import { MATCH_ACTIVE_VIEW_PORT } from '../application/ports/match-active-view.port.js';
import { MATCH_BLOCK_SIDE_EFFECT_PORT } from '../application/ports/match-block-side-effect.port.js';
import { MATCH_HISTORY_MATERIALIZATION_PORT } from '../application/ports/match-history-materialization.port.js';
import { MATCH_LIFECYCLE_SWEEP_PORT } from '../application/ports/match-lifecycle-sweep.port.js';
import { MatchHistoryMaterializationService } from '../history/application/match-history-materialization.service.js';
import { MatchHistoryQueryService } from '../history/application/match-history-query.service.js';
import { MatchHistoryRepository } from '../history/persistence/match-history.repository.js';
import { MatchBlockSideEffectService } from '../lifecycle/match-block-side-effect.service.js';
import { MatchesService } from '../matches.service.js';
import { MatchRequestNoteModerationAdapter } from '../requests/adapters/match-request-note-moderation.adapter.js';
import { AcceptMatchRequestCommand } from '../requests/commands/accept-match-request.command.js';
import { CancelMatchRequestCommand } from '../requests/commands/cancel-match-request.command.js';
import { CreateMatchRequestCommand } from '../requests/commands/create-match-request.command.js';
import { RejectMatchRequestCommand } from '../requests/commands/reject-match-request.command.js';
import { ResolveTerminalMatchRequestCommand } from '../requests/commands/resolve-terminal-match-request.command.js';
import { MatchRequestCreationEvaluator } from '../requests/eligibility/match-request-creation.evaluator.js';
import { MatchRequestAcceptanceRepository } from '../requests/persistence/match-request-acceptance.repository.js';
import { MatchRequestRepository } from '../requests/persistence/match-request.repository.js';
import { MATCH_REQUEST_NOTE_MODERATION_PORT } from '../requests/ports/match-request-note-moderation.port.js';
import { ListCurrentSeasonRequestsQuery } from '../requests/queries/list-current-season-requests.query.js';

export const MATCHES_PROVIDERS = [
  MatchesService,
  ActiveMatchContextGuard,
  ActiveMatchRepository,
  ActiveMatchLifecycleEventRepository,
  ActiveMatchLifecycleEventWriter,
  ActiveMatchLifecycleSweepService,
  ActiveMatchViewQuery,
  MatchHistoryMaterializationService,
  MatchHistoryQueryService,
  MatchHistoryRepository,
  ListCurrentSeasonRequestsQuery,
  CreateMatchRequestCommand,
  AcceptMatchRequestCommand,
  RejectMatchRequestCommand,
  CancelMatchRequestCommand,
  RequestUnmatchCommand,
  CancelUnmatchRequestCommand,
  ResolveTerminalMatchRequestCommand,
  MatchRequestCreationEvaluator,
  MatchRequestAcceptanceRepository,
  MatchRequestRepository,
  MatchRequestNoteModerationAdapter,
  MatchBlockSideEffectService,
  {
    provide: MATCH_ACTIVE_VIEW_PORT,
    useExisting: ActiveMatchViewQuery,
  },
  {
    provide: MATCH_LIFECYCLE_SWEEP_PORT,
    useExisting: ActiveMatchLifecycleSweepService,
  },
  {
    provide: MATCH_HISTORY_MATERIALIZATION_PORT,
    useExisting: MatchHistoryMaterializationService,
  },
  {
    provide: MATCH_BLOCK_SIDE_EFFECT_PORT,
    useExisting: MatchBlockSideEffectService,
  },
  {
    provide: MATCH_REQUEST_NOTE_MODERATION_PORT,
    useExisting: MatchRequestNoteModerationAdapter,
  },
] satisfies NonNullable<ModuleMetadata['providers']>;
