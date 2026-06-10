import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from '../../season-participants/current-season-participation.controller.js';
import { DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY } from '../../platform/domain-context/domain-context.decorator.js';
import type { ChatThreadMemberContextRequirement } from '../../chat/context/chat-thread-context-requirement.js';
import type { ActiveMatchParticipantContextRequirement } from '../../matches/context/active-match-context-requirement.js';
import type { CurrentSeasonParticipantContextRequirement } from '../../season-participants/context/current-season-participant-context-requirement.js';
import { CurrentSeasonParticipantContextGuard } from '../../season-participants/context/current-season-participant-context.guard.js';
import { ChatController } from '../../chat/chat.controller.js';
import { ChatThreadContextGuard } from '../../chat/context/chat-thread-context.guard.js';
import { MatchesController } from '../../matches/matches.controller.js';
import { ActiveMatchContextGuard } from '../../matches/active/context/active-match-context.guard.js';
import { RoommateSearchController } from '../../profiles/roommate-search.controller.js';
import { ProfilesController } from '../../profiles/profiles.controller.js';

const NEST_GUARDS_METADATA = '__guards__';

type DomainContextRequirement =
  | ChatThreadMemberContextRequirement
  | ActiveMatchParticipantContextRequirement
  | CurrentSeasonParticipantContextRequirement;

interface ExpectedDomainContextRoute {
  controller: new (...args: never[]) => unknown;
  handler: string;
  path: string;
  domainContexts: readonly DomainContextRequirement[];
  guards?: readonly unknown[];
}

const expectedCurrentSeasonParticipantRoutes: ExpectedDomainContextRoute[] = [
  {
    controller: CurrentSeasonProfileController,
    handler: 'createOrUpdateSeasonProfileDraft',
    path: 'PUT /api/seasons/current/profile',
    domainContexts: [
      {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
        failure: 'season-profile-draft-not-allowed',
      },
    ],
    guards: [CurrentSeasonParticipantContextGuard],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'createOrUpdateDormitorySelection',
    path: 'POST /api/seasons/current/participation/dormitory-selection',
    domainContexts: [
      {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
        failure: 'season-profile-draft-not-allowed',
      },
    ],
    guards: [CurrentSeasonParticipantContextGuard],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'finalizeSeasonRegistration',
    path: 'POST /api/seasons/current/participation/registration',
    domainContexts: [
      {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
        failure: 'registration-not-allowed',
      },
    ],
    guards: [CurrentSeasonParticipantContextGuard],
  },
];

const expectedCurrentSeasonParticipantExcludedRoutes: ExpectedDomainContextRoute[] = [
  {
    controller: CurrentSeasonProfileController,
    handler: 'getCurrentSeasonProfile',
    path: 'GET /api/seasons/current/profile',
    domainContexts: [],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'listSelectableDormitories',
    path: 'GET /api/seasons/current/participation/selectable-dormitories',
    domainContexts: [],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'deregister',
    path: 'POST /api/seasons/current/participation/deregister',
    domainContexts: [],
  },
];

const expectedChatAndActiveMatchContextRoutes: ExpectedDomainContextRoute[] = [
  {
    controller: ChatController,
    handler: 'getThreadDetail',
    path: 'GET /api/chat/threads/:threadId',
    domainContexts: [
      {
        kind: 'chat-thread-member',
        mode: 'require-existing',
        param: 'threadId',
      },
    ],
    guards: [ChatThreadContextGuard],
  },
  {
    controller: ChatController,
    handler: 'updateReadMarker',
    path: 'POST /api/chat/threads/:threadId/read-marker',
    domainContexts: [
      {
        kind: 'chat-thread-member',
        mode: 'require-existing',
        param: 'threadId',
      },
    ],
    guards: [ChatThreadContextGuard],
  },
  {
    controller: MatchesController,
    handler: 'requestUnmatch',
    path: 'POST /api/matches/active/:id/unmatch-request',
    domainContexts: [
      {
        kind: 'active-match-participant',
        mode: 'require-existing',
        param: 'id',
        failure: 'unmatch-request-not-allowed',
      },
    ],
    guards: [ActiveMatchContextGuard],
  },
  {
    controller: MatchesController,
    handler: 'cancelUnmatchRequest',
    path: 'POST /api/matches/active/:id/unmatch-request/cancel',
    domainContexts: [
      {
        kind: 'active-match-participant',
        mode: 'require-existing',
        param: 'id',
        failure: 'unmatch-cancel-not-allowed',
      },
    ],
    guards: [ActiveMatchContextGuard],
  },
];

const expectedChatAndActiveMatchContextExcludedRoutes: ExpectedDomainContextRoute[] = [
  {
    controller: ChatController,
    handler: 'getThreads',
    path: 'GET /api/chat/threads',
    domainContexts: [],
  },
  {
    controller: ChatController,
    handler: 'getConversationStats',
    path: 'GET /api/chat/conversation-stats',
    domainContexts: [],
  },
  {
    controller: ChatController,
    handler: 'getThreadEntry',
    path: 'GET /api/chat/threads/with/:targetUserId',
    domainContexts: [],
  },
  {
    controller: ChatController,
    handler: 'replayRealtimeEvents',
    path: 'GET /api/chat/realtime/replay',
    domainContexts: [],
  },
  {
    controller: ChatController,
    handler: 'issueRealtimeTicket',
    path: 'POST /api/chat/realtime/tickets',
    domainContexts: [],
  },
  {
    controller: ChatController,
    handler: 'leaveThread',
    path: 'POST /api/chat/threads/:threadId/leave',
    domainContexts: [],
  },
  {
    controller: ChatController,
    handler: 'sendMessage',
    path: 'POST /api/chat/messages',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'getRequests',
    path: 'GET /api/matches/requests',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'createRequest',
    path: 'POST /api/matches/requests',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'acceptRequest',
    path: 'POST /api/matches/requests/:id/accept',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'rejectRequest',
    path: 'POST /api/matches/requests/:id/reject',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'cancelRequest',
    path: 'POST /api/matches/requests/:id/cancel',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'getActiveMatch',
    path: 'GET /api/matches/active',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'getHistory',
    path: 'GET /api/matches/history',
    domainContexts: [],
  },
  {
    controller: MatchesController,
    handler: 'getHistoryCounterpartProfile',
    path: 'GET /api/matches/history/entries/:entryId/counterpart-profile',
    domainContexts: [],
  },
];

const expectedPublicTargetPolicyCanonicalRoutes: ExpectedDomainContextRoute[] = [
  {
    controller: RoommateSearchController,
    handler: 'getManifest',
    path: 'GET /api/roommate-search/manifest',
    domainContexts: [],
  },
  {
    controller: RoommateSearchController,
    handler: 'search',
    path: 'GET /api/roommate-search',
    domainContexts: [],
  },
  {
    controller: ProfilesController,
    handler: 'getProfileByUserId',
    path: 'GET /api/profiles/:userId',
    domainContexts: [],
  },
];

function resolveDomainContexts(
  controller: ExpectedDomainContextRoute['controller'],
  handler: string,
) {
  const methodRef = getRouteHandler(controller, handler);
  return [
    ...readDomainContexts(controller),
    ...readDomainContexts(methodRef),
  ] satisfies DomainContextRequirement[];
}

function readDomainContexts(target: object): DomainContextRequirement[] {
  return (
    (Reflect.getMetadata(DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY, target) as
      | DomainContextRequirement[]
      | undefined) ?? []
  );
}

function getRouteHandler(
  controller: ExpectedDomainContextRoute['controller'],
  handler: string,
): object {
  const methodRef = (controller.prototype as Record<string, object | undefined>)[handler];
  if (!methodRef) {
    throw new Error(`Expected route handler ${controller.name}.${handler}`);
  }
  return methodRef;
}

describe('Domain context route matrix', () => {
  it.each(expectedCurrentSeasonParticipantRoutes)(
    '$path#$handler는 current-season-participant context metadata를 요구한다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
    },
  );

  it.each(expectedCurrentSeasonParticipantRoutes)(
    '$path#$handler는 current-season-participant context guard도 route method에 직접 적용한다',
    ({ controller, handler, guards }) => {
      expect(resolveRouteGuards(controller, handler)).toEqual(guards);
    },
  );

  it.each(expectedCurrentSeasonParticipantExcludedRoutes)(
    '$path#$handler는 current-season-participant context guard 대상이 아니다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
      expect(resolveRouteGuards(controller, handler)).toEqual([]);
    },
  );

  it.each(expectedChatAndActiveMatchContextRoutes)(
    '$path#$handler는 chat/active-match domain context metadata를 요구한다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
    },
  );

  it.each(expectedChatAndActiveMatchContextRoutes)(
    '$path#$handler는 chat/active-match domain context guard도 route method에 직접 적용한다',
    ({ controller, handler, guards }) => {
      expect(resolveRouteGuards(controller, handler)).toEqual(guards);
    },
  );

  it.each(expectedChatAndActiveMatchContextExcludedRoutes)(
    '$path#$handler는 chat/active-match domain context guard 대상이 아니다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
      expect(resolveRouteGuards(controller, handler)).toEqual([]);
    },
  );

  it.each(expectedPublicTargetPolicyCanonicalRoutes)(
    '$path#$handler는 public target policy를 canonical으로 유지하므로 viewer/target context guard를 적용하지 않는다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
      expect(resolveRouteGuards(controller, handler)).toEqual([]);
    },
  );
});

function resolveRouteGuards(controller: ExpectedDomainContextRoute['controller'], handler: string) {
  const methodRef = getRouteHandler(controller, handler);
  return (Reflect.getMetadata(NEST_GUARDS_METADATA, methodRef) as unknown[] | undefined) ?? [];
}
