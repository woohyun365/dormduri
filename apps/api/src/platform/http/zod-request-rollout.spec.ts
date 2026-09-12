import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  BadRequestException,
  type INestApplication,
  type PipeTransform,
  type Type,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/application/auth.service.js';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import { ChatController } from '../../chat/chat.controller.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { ChatRealtimeTicketService } from '../../chat/realtime/chat-realtime-ticket.service.js';
import { ChatRealtimeRateLimiterService } from '../../chat/realtime/chat-realtime-rate-limiter.service.js';
import { ChatRealtimeMetricsService } from '../../chat/realtime/chat-realtime.metrics.js';
import { ChatThreadContextResolver } from '../../chat/context/chat-thread-context.resolver.js';
import { MatchesController } from '../../matches/matches.controller.js';
import { MatchesService } from '../../matches/application/matches.service.js';
import { ActiveMatchContextGuard } from '../../matches/active/context/active-match-context.guard.js';
import {
  CurrentSeasonProfileController,
  CurrentSeasonParticipationController,
  SeasonProfileHistoryController,
} from '../../season-participants/current-season-participation.controller.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import { CurrentSeasonParticipantContextResolver } from '../../season-participants/context/current-season-participant-context.resolver.js';
import { SupportController } from '../../support/support.controller.js';
import { SupportService } from '../../support/application/support.service.js';
import { LegalController } from '../../legal/legal.controller.js';
import { LegalService } from '../../legal/application/legal.service.js';
import { NoticesController } from '../../notices/notices.controller.js';
import { NoticesService } from '../../notices/application/notices.service.js';
import { RoommateSearchController } from '../../roommate-search/roommate-search.controller.js';
import { RoommateSearchService } from '../../roommate-search/application/roommate-search.service.js';
import { UsersController } from '../../users/users.controller.js';
import { UsersService } from '../../users/application/users.service.js';
import { SeasonsController } from '../../seasons/seasons.controller.js';
import { SeasonsService } from '../../seasons/application/seasons.service.js';
import { SeasonsOperationsController } from '../../seasons/operations/seasons-operations.controller.js';
import { UpdateSeasonScheduleCommand } from '../../seasons/operations/update-season-schedule.command.js';
import { UpdateSeasonOverrideCommand } from '../../seasons/operations/update-season-override.command.js';
import { ClearSeasonOverrideCommand } from '../../seasons/operations/clear-season-override.command.js';
import { BlockController } from '../../social-safety/blocks/block.controller.js';
import { BlockService } from '../../social-safety/blocks/application/block.service.js';
import { BookmarkController } from '../../social-safety/bookmarks/bookmark.controller.js';
import { BookmarkService } from '../../social-safety/bookmarks/application/bookmark.service.js';
import { ReportController } from '../../social-safety/reports/report.controller.js';
import { ReportIntakeService } from '../../social-safety/reports/application/report-intake.service.js';
import { EnforcementNoticeController } from '../../social-safety/enforcements/enforcement-notice.controller.js';
import { EnforcementNoticeService } from '../../social-safety/enforcements/application/enforcement-notice.service.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

const actor = {
  id: 'user-1',
  actorId: 'user-1',
  actorType: 'USER',
  sessionId: 'session-1',
  campus: 'CHUNCHEON',
  gender: 'M',
  capabilities: [
    'user:read:self',
    'user:update:self',
    'auth:password:change:self',
    'admin:support:read',
    'admin:support:reply',
    'admin:support:resolve',
    'admin:season:operations:write',
  ],
};
const authContext = { requestIp: '127.0.0.1', userAgent: 'rollout-test' };
const signupBody = {
  email: 'TEST@kangwon.ac.kr',
  password: 'Test1234',
  nickname: ' 테스터 ',
  gender: 'M',
  campus: 'CHUNCHEON',
  collegeCode: 'CHUNCHEON_IT',
  birthYear: 2002,
  legalAcceptances: {
    termsVersionId: ' terms-v1 ',
    personalDataConsentVersionId: ' consent-v1 ',
    ageNoticeVersionId: ' age-v1 ',
    privacyPolicyVersionIdShown: ' privacy-v1 ',
  },
};
const parsedSignup = {
  ...signupBody,
  email: 'test@kangwon.ac.kr',
  nickname: '테스터',
  legalAcceptances: {
    termsVersionId: 'terms-v1',
    personalDataConsentVersionId: 'consent-v1',
    ageNoticeVersionId: 'age-v1',
    privacyPolicyVersionIdShown: 'privacy-v1',
  },
};
const profileBody = {
  lifestyle: {
    bedtime: 'BEFORE_22',
    wakeTime: 'BEFORE_07',
    sleepHabit: 'NONE',
    sleepEnvironment: 'QUIET',
    screenUsage: 'NONE',
    noiseSensitivity: 'NORMAL',
    smokingBehavior: 'NO',
    indoorEating: 'RARELY',
    phoneBehavior: 'RARELY',
    earphoneUsage: 'ALWAYS',
    cleanLevel: 'WHEN_DIRTY',
    drinkingFrequency: 'NONE',
    relationshipStyle: 'CASUAL',
    temperatureSensitivity: 'NORMAL',
    smokingTolerance: 'NO_ONLY',
    phoneTolerance: 'OUTSIDE_ONLY',
    earphoneExpectation: 'MUST',
    sleepEnvPreference: 'NO_SPEAKER',
    screenTolerance: 'NO_SCREEN',
    indoorEatingTolerance: 'NO_SMELL',
    cleanExpectation: 'STRICT',
    drinkingTolerance: 'LOW_ONLY',
  },
  additional: { grade: '2', mbti: 'ISTJ' },
};
const expectedUpdatedAt = '2026-09-01T00:00:00.000Z';
const providers = new Map<Type<unknown>, Record<string, Mock>>();
function service(type: Type<unknown>, method: string) {
  let value = providers.get(type);
  if (!value) {
    value = {};
    providers.set(type, value);
  }
  return (value[method] ??= vi.fn());
}
interface RouteCase {
  controller: Type<unknown>;
  method: string;
  verb: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  service: Mock;
  args: unknown[];
  body?: Record<string, unknown>;
  invalidPath?: string;
  coupled?: boolean;
  status?: number;
}
const cases: RouteCase[] = [];
function row(
  controller: Type<unknown>,
  method: string,
  verb: RouteCase['verb'],
  path: string,
  owner: Type<unknown>,
  args: unknown[],
  options: Partial<
    Omit<RouteCase, 'controller' | 'method' | 'verb' | 'path' | 'service' | 'args'>
  > = {},
  serviceMethod = method,
) {
  cases.push({
    controller,
    method,
    verb,
    path,
    service: service(owner, serviceMethod),
    args,
    ...options,
  });
}
for (const method of ['sendSignupCode', 'sendResetCode'] as const)
  row(
    AuthController,
    method,
    'post',
    `/auth/${method === 'sendSignupCode' ? 'send-signup-code' : 'send-reset-code'}`,
    AuthService,
    ['test@kangwon.ac.kr', authContext],
    { body: { email: 'TEST@kangwon.ac.kr' } },
  );
for (const method of ['verifyEmailCode', 'verifyResetCode'] as const)
  row(
    AuthController,
    method,
    'post',
    `/auth/${method === 'verifyEmailCode' ? 'verify-email-code' : 'verify-reset-code'}`,
    AuthService,
    ['test@kangwon.ac.kr', '123456', authContext],
    { body: { email: 'TEST@kangwon.ac.kr', code: ' 123456 ' } },
  );
row(
  AuthController,
  'validateSignupNickname',
  'post',
  '/auth/signup/validate-nickname',
  AuthService,
  ['ABC', 'grant-1'],
  { body: { nickname: ' ＡＢＣ ' }, status: 200 },
);
row(
  AuthController,
  'signup',
  'post',
  '/auth/signup',
  AuthService,
  [parsedSignup, 'grant-1', authContext],
  { body: signupBody },
);
row(
  AuthController,
  'login',
  'post',
  '/auth/login',
  AuthService,
  ['test@kangwon.ac.kr', 'Test1234', false, authContext],
  { body: { email: 'TEST@kangwon.ac.kr', password: 'Test1234' }, status: 200 },
);
row(
  AuthController,
  'resetPassword',
  'post',
  '/auth/reset-password',
  AuthService,
  ['grant-1', 'Test1234', authContext],
  { body: { newPassword: 'Test1234' } },
);
row(
  AuthController,
  'changePassword',
  'post',
  '/auth/change-password',
  AuthService,
  [actor, 'Test1234', 'New12345', authContext],
  { body: { currentPassword: 'Test1234', newPassword: 'New12345' }, status: 200 },
);
row(
  AuthController,
  'renewSession',
  'post',
  '/auth/renew-session',
  AuthService,
  [' not-an-opaque-token ', authContext],
  { body: { renewalToken: ' not-an-opaque-token ' }, status: 200 },
);
row(
  AuthController,
  'logout',
  'post',
  '/auth/logout',
  AuthService,
  ['valid-token', null, authContext],
  { body: {}, status: 200 },
);
row(
  ChatController,
  'updateReadMarker',
  'post',
  '/api/chat/threads/thread-1/read-marker',
  ChatService,
  [actor, 'thread-1', { lastReadMessageId: ' message-1 ' }],
  { body: { lastReadMessageId: ' message-1 ' } },
);
row(
  ChatController,
  'sendMessage',
  'post',
  '/api/chat/messages',
  ChatService,
  [actor, { targetUserId: '', body: 'hello', clientMessageId: 'client-1' }],
  { body: { targetUserId: '', body: ' hello ', clientMessageId: ' client-1 ' } },
);
row(
  MatchesController,
  'createRequest',
  'post',
  '/api/matches/requests',
  MatchesService,
  [actor, { targetUserId: '', note: '' }],
  { body: { targetUserId: '', note: '  ' } },
  'createMatchRequest',
);
row(
  CurrentSeasonProfileController,
  'createOrUpdateSeasonProfileDraft',
  'put',
  '/api/seasons/current/profile',
  SeasonParticipantsService,
  ['user-1', { ...profileBody, intro: '' }],
  { body: profileBody },
);
row(
  SeasonProfileHistoryController,
  'getSeasonProfileHistory',
  'get',
  '/api/seasons/%20/profile/me',
  SeasonParticipantsService,
  ['user-1', ' '],
);
row(
  CurrentSeasonParticipationController,
  'createOrUpdateDormitorySelection',
  'post',
  '/api/seasons/current/participation/dormitory-selection',
  SeasonParticipantsService,
  ['user-1', { dormitoryId: '' }],
  { body: { dormitoryId: '' } },
);
row(
  CurrentSeasonParticipationController,
  'finalizeSeasonRegistration',
  'post',
  '/api/seasons/current/participation/registration',
  SeasonParticipantsService,
  ['user-1'],
  { body: {} },
);
row(SupportController, 'listOwnTickets', 'get', '/api/support/tickets', SupportService, [
  actor,
  { limit: 20 },
]);
row(
  SupportController,
  'getOwnTicket',
  'get',
  '/api/support/tickets/%20ticket-1%20',
  SupportService,
  [actor, 'ticket-1'],
  { invalidPath: '/api/support/tickets/%20' },
);
row(
  SupportController,
  'listOperationTickets',
  'get',
  '/api/operations/support/tickets',
  SupportService,
  [{ limit: 20 }],
);
row(
  SupportController,
  'getOperationTicket',
  'get',
  '/api/operations/support/tickets/%20ticket-1%20',
  SupportService,
  ['ticket-1'],
  { invalidPath: '/api/operations/support/tickets/%20' },
);
row(
  SupportController,
  'replyAsOperator',
  'post',
  '/api/operations/support/tickets/%20ticket-1%20/replies',
  SupportService,
  [actor, 'ticket-1', { body: 'hello', status: 'WAITING_USER' }],
  {
    body: { body: ' hello ' },
    invalidPath: '/api/operations/support/tickets/%20/replies',
    coupled: true,
  },
);
row(
  SupportController,
  'resolveAsOperator',
  'post',
  '/api/operations/support/tickets/%20ticket-1%20/resolve',
  SupportService,
  [actor, 'ticket-1', { status: 'RESOLVED' }],
  { body: {}, invalidPath: '/api/operations/support/tickets/%20/resolve', coupled: true },
);
row(
  LegalController,
  'getActiveDocument',
  'get',
  '/api/legal/documents/TERMS_OF_SERVICE/active',
  LegalService,
  ['TERMS_OF_SERVICE'],
  { invalidPath: '/api/legal/documents/MARKETING_CONSENT/active' },
);
row(NoticesController, 'listGlobalNotices', 'get', '/api/notices', NoticesService, [{ limit: 3 }]);
row(
  NoticesController,
  'getGlobalNotice',
  'get',
  '/api/notices/%20notice-1%20',
  NoticesService,
  ['notice-1'],
  { invalidPath: '/api/notices/%20' },
);
row(
  RoommateSearchController,
  'getManifest',
  'get',
  '/api/roommate-search/manifest',
  RoommateSearchService,
  [actor, {}],
);
row(
  RoommateSearchController,
  'search',
  'get',
  '/api/roommate-search?minScore=80&grade.operator=INCLUDE&grade.values=2&ageBand.values[]=20&ageBand.values[]=21',
  RoommateSearchService,
  [
    actor,
    {
      limit: 20,
      minScore: 80,
      grade: { operator: 'INCLUDE', values: ['2'] },
      ageBand: { values: ['20', '21'] },
    },
  ],
);
row(
  UsersController,
  'updateCurrentUser',
  'patch',
  '/api/users/me',
  UsersService,
  [actor, { displayIdentity: { nickname: 'ABC' } }],
  { body: { displayIdentity: { nickname: ' ＡＢＣ ' } } },
);
row(
  UsersController,
  'dismissCurrentUserOnboardingNotice',
  'patch',
  '/api/users/me/onboarding',
  UsersService,
  [actor, { noticeKey: 'service-intro' }],
  { body: { noticeKey: 'service-intro' } },
);
row(
  UsersController,
  'requestAccountDeletion',
  'post',
  '/api/users/me/delete',
  UsersService,
  [actor, { password: ' password ' }],
  { body: { password: ' password ' } },
);
row(
  SeasonsController,
  'getCurrentSeason',
  'get',
  '/api/seasons/current?campus=CHUNCHEON',
  SeasonsService,
  ['CHUNCHEON'],
  { invalidPath: '/api/seasons/current' },
);
row(
  SeasonsOperationsController,
  'updateSchedule',
  'patch',
  '/api/campuses/CHUNCHEON/seasons/%20/schedule',
  UpdateSeasonScheduleCommand,
  [
    'CHUNCHEON',
    ' ',
    {
      expectedUpdatedAt,
      preparationStartDate: '2026-09-01',
      matchingStartDate: '2026-09-02',
      seasonEndDate: '2026-12-31',
      name: 'name',
    },
    actor,
  ],
  {
    body: {
      expectedUpdatedAt,
      preparationStartDate: '2026-09-01',
      matchingStartDate: '2026-09-02',
      seasonEndDate: '2026-12-31',
      name: ' name ',
    },
    invalidPath: '/api/campuses/WRONG/seasons/%20/schedule',
    coupled: true,
  },
  'execute',
);
row(
  SeasonsOperationsController,
  'updateOverride',
  'patch',
  '/api/campuses/CHUNCHEON/seasons/%20/override',
  UpdateSeasonOverrideCommand,
  [
    'CHUNCHEON',
    ' ',
    { expectedUpdatedAt, state: 'SEASON_OPEN', reason: 'reason', startsAt: null },
    actor,
  ],
  {
    body: { expectedUpdatedAt, state: 'SEASON_OPEN', reason: ' reason ', startsAt: null },
    invalidPath: '/api/campuses/WRONG/seasons/%20/override',
    coupled: true,
  },
  'execute',
);
row(
  SeasonsOperationsController,
  'clearOverride',
  'delete',
  '/api/campuses/CHUNCHEON/seasons/%20/override',
  ClearSeasonOverrideCommand,
  ['CHUNCHEON', ' ', { expectedUpdatedAt, reason: 'reason' }, actor],
  {
    body: { expectedUpdatedAt, reason: ' reason ' },
    invalidPath: '/api/campuses/WRONG/seasons/%20/override',
    coupled: true,
  },
  'execute',
);
row(BlockController, 'list', 'get', '/api/blocks', BlockService, [actor, { limit: 20 }]);
row(
  BlockController,
  'create',
  'post',
  '/api/blocks/%20target-1%20',
  BlockService,
  [actor, 'target-1', { note: 'note' }],
  { body: { note: ' note ' }, invalidPath: '/api/blocks/%20', coupled: true },
);
row(
  BlockController,
  'delete',
  'delete',
  '/api/blocks/%20target-1%20',
  BlockService,
  [actor, 'target-1'],
  { body: {}, invalidPath: '/api/blocks/%20', coupled: true },
);
row(BookmarkController, 'list', 'get', '/api/bookmarks', BookmarkService, [
  actor,
  { sort: 'RECENT', limit: 20 },
]);
row(
  BookmarkController,
  'create',
  'post',
  '/api/bookmarks/%20target-1%20',
  BookmarkService,
  [actor, 'target-1'],
  { invalidPath: '/api/bookmarks/%20' },
);
row(
  BookmarkController,
  'delete',
  'delete',
  '/api/bookmarks/%20target-1%20',
  BookmarkService,
  [actor, 'target-1'],
  { invalidPath: '/api/bookmarks/%20' },
);
row(ReportController, 'listOwn', 'get', '/api/reports', ReportIntakeService, [
  actor,
  { limit: 20 },
]);
row(
  ReportController,
  'create',
  'post',
  '/api/reports',
  ReportIntakeService,
  [
    actor,
    {
      targetType: 'PROFILE',
      targetId: 'target-1',
      reason: 'OTHER',
      detail: 'detail',
      evidenceAttachmentIds: [],
      falseReportDisclaimerAccepted: true,
    },
  ],
  {
    body: {
      targetType: 'PROFILE',
      targetId: ' target-1 ',
      reason: 'OTHER',
      detail: ' detail ',
      falseReportDisclaimerAccepted: true,
    },
  },
);
row(EnforcementNoticeController, 'listOwn', 'get', '/api/enforcements', EnforcementNoticeService, [
  actor,
  { limit: 20 },
]);

const authResolver = { resolveCurrentUserContext: vi.fn() };
const participantResolver = { resolveForActor: vi.fn() };
const threadResolver = { resolveVisibleActiveMemberContext: vi.fn() };
const limiter = { consumeMessageSend: vi.fn() };
const metrics = { recordRateLimitRejection: vi.fn(), recordException: vi.fn() };
function pipes(route: RouteCase): PipeTransform<unknown, unknown>[] {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, route.controller, route.method) as
    Record<string, { pipes?: PipeTransform<unknown, unknown>[] }> | undefined;
  return Object.values(metadata ?? {}).flatMap((arg) => arg.pipes ?? []);
}
function stableError(response: request.Response) {
  expect(response.status).toBe(400);
  const { timestamp, ...error } = response.body as Record<string, unknown>;
  expect(timestamp).toEqual(expect.any(String));
  return error;
}

describe('rollout HTTP contract', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [...new Set(cases.map((route) => route.controller))],
      providers: [
        ...[...providers].map(([provide, useValue]) => ({ provide, useValue })),
        { provide: AuthActorContextResolver, useValue: authResolver },
        { provide: CurrentSeasonParticipantContextResolver, useValue: participantResolver },
        { provide: ChatThreadContextResolver, useValue: threadResolver },
        { provide: ChatRealtimeRateLimiterService, useValue: limiter },
        { provide: ChatRealtimeTicketService, useValue: {} },
        { provide: ChatRealtimeMetricsService, useValue: metrics },
        AuthenticatedUserGuard,
        Reflector,
      ],
      // Unmatch routes are outside this fixture; the create-request route has no active-match guard.
    })
      .overrideGuard(ActiveMatchContextGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(module.get(AuthenticatedUserGuard));
    app.useGlobalFilters(
      new ApiExceptionFilter(
        { write: vi.fn() } as never,
        metrics as never,
        module.get(HttpAdapterHost),
      ),
    );
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    for (const value of providers.values())
      for (const mock of Object.values(value)) mock.mockReturnValue({ success: true });
    authResolver.resolveCurrentUserContext.mockImplementation((token: string) =>
      token === 'valid-token' ? actor : null,
    );
    participantResolver.resolveForActor.mockResolvedValue({ userId: 'user-1' });
    threadResolver.resolveVisibleActiveMemberContext.mockResolvedValue({
      actorUserId: 'user-1',
      threadId: 'thread-1',
    });
    limiter.consumeMessageSend.mockReturnValue({ allowed: true });
  });
  function send(
    route: RouteCase,
    path = route.path,
    body: Record<string, unknown> | undefined = route.body,
  ) {
    const call = request(url)
      [route.verb](path)
      .auth('valid-token', { type: 'bearer' })
      .set('User-Agent', 'rollout-test')
      .set('X-Auth-Verification-Grant', 'grant-1');
    return body === undefined ? call : call.send(body);
  }
  const named = cases.map((route) => ({
    ...route,
    name: `${route.controller.name}.${route.method}`,
  }));
  it.each(named)('legacy parsed input and response: $name', async (route) => {
    const response = await send(route);
    expect(response.status, JSON.stringify(response.body)).toBe(
      route.status ?? (route.verb === 'post' ? 201 : 200),
    );
    expect(response.body).toEqual({ success: true });
    expect(route.service).toHaveBeenCalledExactlyOnceWith(...route.args);
  });
  it.each(named.filter((route) => route.method !== 'getSeasonProfileHistory'))(
    'legacy exact invalid envelope and no service: $name',
    async (route) => {
      const path =
        route.invalidPath && !route.coupled
          ? route.invalidPath
          : route.body
            ? route.path
            : `${route.path}${route.path.includes('?') ? '&' : '?'}extra=true`;
      const response = await send(
        route,
        path,
        route.body ? { ...route.body, extra: true } : undefined,
      );
      expect(stableError(response)).toMatchSnapshot();
      expect(route.service).not.toHaveBeenCalled();
      expect(limiter.consumeMessageSend).not.toHaveBeenCalled();
    },
  );
  it.each(named.filter((route) => route.body))('legacy missing body: $name', async (route) => {
    // Explicitly omit the payload; Express may expose undefined or an empty object.
    const missing = await request(url)
      [route.verb](route.path)
      .auth('valid-token', { type: 'bearer' })
      .set('User-Agent', 'rollout-test')
      .set('X-Auth-Verification-Grant', 'grant-1');
    const { timestamp, ...body } = missing.body as Record<string, unknown>;
    if (missing.status === 400) expect(timestamp).toEqual(expect.any(String));
    expect({ status: missing.status, body, calls: route.service.mock.calls }).toMatchSnapshot();
    if (missing.status === 400) expect(route.service).not.toHaveBeenCalled();
  });
  it.each(named.filter((route) => route.coupled))(
    'legacy path first for every input combination: $name',
    async (route) => {
      for (const body of [route.body, { extra: true }, { extra: true }, { extra: true }]) {
        expect(stableError(await send(route, route.invalidPath, body))).toMatchSnapshot();
      }
      expect(route.service).not.toHaveBeenCalled();
    },
  );
  it('legacy invalid chat body precedes limiter and metric side effects', async () => {
    limiter.consumeMessageSend.mockReturnValue({
      allowed: false,
      scope: 'user',
      retryAfterSeconds: 1,
    });
    const route = cases.find((row) => row.method === 'sendMessage')!;
    expect(
      stableError(await send(route, route.path, { targetUserId: 'x', body: ' ' })),
    ).toMatchSnapshot();
    expect(limiter.consumeMessageSend).not.toHaveBeenCalled();
    expect(metrics.recordRateLimitRejection).not.toHaveBeenCalled();
    expect(route.service).not.toHaveBeenCalled();
  });
  it.each([
    'createOrUpdateSeasonProfileDraft',
    'createOrUpdateDormitorySelection',
    'finalizeSeasonRegistration',
    'updateReadMarker',
  ])('legacy invalid body before local actor mismatch: %s', async (method) => {
    participantResolver.resolveForActor.mockResolvedValue({ userId: 'other' });
    threadResolver.resolveVisibleActiveMemberContext.mockResolvedValue({
      actorUserId: 'other',
      threadId: 'thread-1',
    });
    const route = cases.find((row) => row.method === method)!;
    expect(stableError(await send(route, route.path, { extra: true }))).toMatchSnapshot();
    expect(route.service).not.toHaveBeenCalled();
  });
  it.each([
    ['login', {}, ['email', 'password']],
    [
      'signup',
      { ...signupBody, lifestyle: {}, intro: 'signup draft', additional: { grade: 2 } },
      [],
    ],
    ['validateSignupNickname', { nickname: 'name', email: 'test@kangwon.ac.kr', profile: {} }, []],
    ['sendMessage', { targetUserId: 'x', body: ' ', clientMessageId: 'id' }, ['body']],
    ['sendMessage', { targetUserId: 'x', body: 'hello' }, ['clientMessageId']],
    ['sendMessage', { targetUserId: 'x', body: 'x'.repeat(1001), clientMessageId: 'id' }, ['body']],
    ['updateReadMarker', {}, ['lastReadMessageId']],
    ['updateCurrentUser', { selection: { dormitoryId: 'dasan' } }, []],
    ['updateCurrentUser', { intro: 'intro' }, []],
    ['updateCurrentUser', { lifestyle: { smokingBehavior: 'NO' } }, []],
    ['updateCurrentUser', { unsupportedUserPatch: true }, []],
    ['dismissCurrentUserOnboardingNotice', { noticeKey: 'unknown-notice' }, ['noticeKey']],
    ['finalizeSeasonRegistration', { dormitoryId: 'dasan' }, []],
  ] as const)(
    'former direct validation now runs through HTTP: %s %j',
    async (method, body, fields) => {
      const route = cases.find((row) => row.method === method)!;
      const error = stableError(await send(route, route.path, body));
      expect(error.code).toBe('INVALID_REQUEST_BODY');
      for (const field of fields)
        expect(error.fieldErrors).toHaveProperty(
          field,
          expect.arrayContaining([expect.any(String)]),
        );
      if (fields.length === 0)
        expect(error.formErrors).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(route.service).not.toHaveBeenCalled();
      expect(limiter.consumeMessageSend).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined])(
    'nullish compatibility uses the actual ordered bindings: %s',
    (body) => {
      for (const [controller, method, raw, expected] of [
        [AuthController, 'logout', body, {}],
        [CurrentSeasonParticipationController, 'finalizeSeasonRegistration', body, {}],
        [
          SupportController,
          'resolveAsOperator',
          { ticketId: ' ticket-1 ', body },
          { ticketId: 'ticket-1', body: { status: 'RESOLVED' } },
        ],
        [
          BlockController,
          'create',
          { targetUserId: ' target-1 ', body },
          { targetUserId: 'target-1', body: {} },
        ],
        [BlockController, 'delete', { targetUserId: ' target-1 ', body }, 'target-1'],
      ] as const) {
        const route = cases.find((row) => row.controller === controller && row.method === method)!;
        expect(pipes(route)[0]!.transform(raw, { type: 'custom' })).toEqual(expected);
        expect(route.service).not.toHaveBeenCalled();
      }
      for (const [method, raw, field] of [
        ['replyAsOperator', { ticketId: 'ticket-1', body }, 'body'],
        ['clearOverride', { campusCode: 'CHUNCHEON', body }, 'expectedUpdatedAt'],
      ] as const) {
        const route = cases.find((row) => row.method === method)!;
        let thrown: unknown;
        try {
          pipes(route)[0]!.transform(raw, { type: 'custom' });
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(BadRequestException);
        if (!(thrown instanceof BadRequestException))
          throw new Error('Expected request validation error');
        const response = thrown.getResponse() as { fieldErrors: Record<string, string[]> };
        expect(response.fieldErrors[field]).toEqual(expect.any(Array));
      }
    },
  );

  it('protected request rejection precedes the migrated message pipe', async () => {
    const route = cases.find((row) => row.method === 'sendMessage')!;
    const transform = vi.spyOn(pipes(route)[0]!, 'transform');
    const response = await request(url).post(route.path).send({});
    expect(response.status).toBe(401);
    expect(transform).not.toHaveBeenCalled();
    expect(limiter.consumeMessageSend).not.toHaveBeenCalled();
    expect(route.service).not.toHaveBeenCalled();
  });

  it.each(named)('actual Nest parsing pipe executes: $name', async (route) => {
    const bound = pipes(route);
    expect(bound, route.name).toHaveLength(1);
    const transform = vi.spyOn(bound[0]!, 'transform');
    await send(route);
    expect(transform).toHaveBeenCalledOnce();
  });
});
