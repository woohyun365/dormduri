import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { CurrentAuthToken, CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedRequest } from '../../auth/application/auth-actor-context.types.js';
import { ChatThread } from '../../chat/context/chat-thread-context.decorator.js';
import {
  getChatThreadContext,
  setChatThreadContext,
  type ChatThreadContext,
  type ChatThreadContextRequest,
} from '../../chat/context/chat-thread-context.types.js';
import { ActiveMatchContext as CurrentMatch } from '../../matches/active/context/active-match-context.decorator.js';
import {
  getActiveMatchContext,
  setActiveMatchContext,
  type ActiveMatchContext,
  type ActiveMatchContextRequest,
} from '../../matches/active/context/active-match-context.types.js';
import { SeasonParticipant } from '../../season-participants/context/current-season-participant-context.decorator.js';
import {
  getCurrentSeasonParticipantContext,
  setCurrentSeasonParticipantContext,
  type CurrentSeasonParticipantContextRequest,
} from '../../season-participants/context/current-season-participant-context.types.js';
import type { CurrentSeasonParticipantRecord } from '../../season-participants/application/season-participants.service.js';

class CarrierProbe {
  user(@CurrentUser() value: unknown) {
    return value;
  }
  optionalUser(@CurrentUser({ optional: true }) value: unknown) {
    return value;
  }
  token(@CurrentAuthToken() value: unknown) {
    return value;
  }
  optionalToken(@CurrentAuthToken({ optional: true }) value: unknown) {
    return value;
  }
  thread(@ChatThread() value: unknown) {
    return value;
  }
  match(@CurrentMatch() value: unknown) {
    return value;
  }
  participant(@SeasonParticipant() value: unknown) {
    return value;
  }
}

function extract(method: keyof CarrierProbe, request: AuthenticatedRequest) {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, CarrierProbe, method) as Record<
    string,
    {
      data: unknown;
      factory: (data: unknown, context: ExecutionContext) => unknown;
    }
  >;
  const binding = Object.values(metadata)[0];
  if (!binding) throw new Error(`Missing parameter binding: ${method}`);
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
  return binding.factory(binding.data, context);
}

const thread: ChatThreadContext = {
  threadId: 'thread-1',
  actorUserId: 'user-1',
  actorParticipantId: 'participant-1',
  memberState: 'ACTIVE',
  threadStatus: 'OPEN',
  closedAt: null,
  closedReason: null,
  lastVisibleAt: null,
};
const match: ActiveMatchContext = {
  activeMatchId: 'match-1',
  actorUserId: 'user-1',
  actorParticipantId: 'participant-1',
  counterpartParticipantId: 'participant-2',
  status: 'ACTIVE',
  endedAt: null,
};
const now = new Date('2026-06-03T00:00:00.000Z');
const participant: CurrentSeasonParticipantRecord = {
  id: 'participant-1',
  seasonId: 'season-1',
  userId: 'user-1',
  participationIntent: 'UNDECIDED',
  registeredAt: null,
  declinedAt: null,
  dormitoryId: null,
  dormitorySelectionState: 'NOT_SELECTED',
  participantStatus: 'NOT_STARTED',
  campusCodeSnapshot: 'CHUNCHEON',
  genderSnapshot: 'M',
  joinedAt: now,
  activatedAt: null,
  matchedAt: null,
  withdrawnAt: null,
  expiredAt: null,
  hiddenByAdminAt: null,
  hiddenReasonCode: null,
  hiddenReasonDetail: null,
  deactivatedAt: null,
  createdAt: now,
  updatedAt: now,
  profile: null,
};

describe('structural actor and domain-context carriers', () => {
  it('supports cast-free carrier composition, preserves sibling context and returns original identities', () => {
    const request: ChatThreadContextRequest &
      ActiveMatchContextRequest &
      CurrentSeasonParticipantContextRequest = {
      headers: { authorization: 'Bearer token-1' },
      authUser: {
        id: 'user-1',
        sessionId: 'session-1',
        actorType: 'USER',
        actorId: 'user-1',
        campus: 'CHUNCHEON',
        gender: 'M',
        capabilities: [],
      },
      params: { threadId: 'thread-1', id: 'match-1' },
    };
    setChatThreadContext(request, thread);
    const contexts = request.domainContexts;
    setActiveMatchContext(request, match);
    setCurrentSeasonParticipantContext(request, participant);
    expect(request.domainContexts).toBe(contexts);
    expect(getChatThreadContext(request)).toBe(thread);
    expect(getActiveMatchContext(request)).toBe(match);
    expect(getCurrentSeasonParticipantContext(request)).toBe(participant);
    expect(extract('user', request)).toBe(request.authUser);
    expect(extract('optionalUser', request)).toBe(request.authUser);
    expect(extract('token', request)).toBe('token-1');
    expect(extract('thread', request)).toBe(thread);
    expect(extract('match', request)).toBe(match);
    expect(extract('participant', request)).toBe(participant);
  });

  it('empty structural carriers need no native request methods or params', () => {
    const auth: AuthenticatedRequest = { headers: {} };
    const chat: ChatThreadContextRequest = { headers: {} };
    const active: ActiveMatchContextRequest = { headers: {} };
    const season: CurrentSeasonParticipantContextRequest = { headers: {} };
    expect(extract('optionalUser', auth)).toBeNull();
    expect(extract('optionalToken', auth)).toBeNull();
    expect(getChatThreadContext(chat)).toBeNull();
    expect(getActiveMatchContext(active)).toBeNull();
    expect(getCurrentSeasonParticipantContext(season)).toBeNull();
  });

  it.each([
    ['user', '[CurrentUser] guard must run before decorator'],
    ['token', '[CurrentAuthToken] bearer token is required'],
    ['thread', '[ChatThread] guard must run before decorator'],
    ['match', '[ActiveMatchContext] guard must run before decorator'],
    ['participant', '[SeasonParticipant] guard must run before decorator'],
  ] as const)('missing %s remains an invariant error', (method, message) => {
    expect(() => extract(method, { headers: {} })).toThrow(message);
  });
});
