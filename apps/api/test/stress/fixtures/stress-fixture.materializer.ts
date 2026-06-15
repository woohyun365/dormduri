import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { hashPassword as defaultHashPassword } from '../../../src/auth/application/auth-password-hash.js';
import { DEFAULT_DATABASE_URL } from '../../../src/config/database.config.js';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { toCompleteLifestyleColumnData } from '../../../src/season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type { StressActorPlanRow, StressFixturePlan } from './stress-fixture.plan.js';

interface WriteResult {
  readonly count: number;
}

type CreateManyInput = {
  readonly data: readonly Record<string, unknown>[] | Record<string, unknown>;
  readonly skipDuplicates?: boolean;
};

type DeleteManyInput = {
  readonly where?: Record<string, unknown>;
};

interface CreateManyModel {
  createMany(input: CreateManyInput): Promise<WriteResult>;
}

interface DeleteManyModel {
  deleteMany(input: DeleteManyInput): Promise<WriteResult>;
}

interface UpsertModel {
  upsert(input: Record<string, unknown>): Promise<unknown>;
}

export interface StressFixtureMutationClient {
  readonly campusMaster: CreateManyModel;
  readonly collegeMaster: CreateManyModel & DeleteManyModel;
  readonly dormitory: CreateManyModel & DeleteManyModel;
  readonly season: UpsertModel & DeleteManyModel;
  readonly seasonDormitoryOperation: CreateManyModel;
  readonly user: CreateManyModel & DeleteManyModel;
  readonly userDisplayIdentity: CreateManyModel & DeleteManyModel;
  readonly userAcademicIdentity: CreateManyModel & DeleteManyModel;
  readonly userAcademicIdentityChangeAllowance: CreateManyModel & DeleteManyModel;
  readonly seasonParticipant: CreateManyModel & DeleteManyModel;
  readonly seasonParticipantProfile: CreateManyModel & DeleteManyModel;
  readonly seasonParticipantProfileHistory: CreateManyModel & DeleteManyModel;
  readonly userBookmark: CreateManyModel & DeleteManyModel;
  readonly matchRequest: CreateManyModel & DeleteManyModel;
  readonly conversationThread: CreateManyModel & DeleteManyModel;
  readonly conversationThreadMember: CreateManyModel & DeleteManyModel;
  readonly conversationMessage: CreateManyModel & DeleteManyModel;
  readonly userNotification: CreateManyModel & DeleteManyModel;
  readonly supportFaqArticle: CreateManyModel & DeleteManyModel;
  readonly supportTicket: CreateManyModel & DeleteManyModel;
  readonly supportTicketMessage: CreateManyModel & DeleteManyModel;
  readonly reportCase: CreateManyModel & DeleteManyModel;
  readonly reportCaseEvent: CreateManyModel & DeleteManyModel;
  readonly authSession: DeleteManyModel;
  readonly authSecurityEvent: DeleteManyModel;
  readonly loginAttempt: DeleteManyModel;
  readonly verificationCode: DeleteManyModel;
  readonly verificationCodeRequestLog: DeleteManyModel;
  readonly $transaction?: <T>(
    callback: (tx: StressFixtureMutationClient) => Promise<T>,
  ) => Promise<T>;
}

export interface StressFixturePrismaClientHandle {
  readonly client: StressFixtureMutationClient;
  readonly disconnect: () => Promise<void>;
}

export interface StressFixtureMaterializerDeps {
  readonly hashPassword?: (password: string) => Promise<string>;
  readonly now?: Date;
}

export interface StressFixtureMaterializationSummary {
  readonly mode: 'applied';
  readonly databaseMutation: true;
  readonly marker: string;
  readonly counts: {
    readonly actors: number;
    readonly dormitories: number;
    readonly seasonDormitoryOperations: number;
    readonly bookmarks: number;
    readonly matchRequests: number;
    readonly conversationThreads: number;
    readonly conversationMessages: number;
    readonly notifications: number;
    readonly supportTickets: number;
    readonly reports: number;
  };
}

export interface StressFixtureResetSummary {
  readonly mode: 'applied-reset';
  readonly databaseMutation: true;
  readonly marker: string;
  readonly deleted: readonly { readonly model: string; readonly count: number }[];
}

const DEFAULT_COLLEGE_CODE = 'stress-college';
const DEFAULT_NOW = new Date('2026-06-15T00:00:00.000Z');
const STRESS_FIXTURE_APPLICATION_NAME = 'knu-roommate-api-stress-fixture';
const STRESS_FIXTURE_POOL_MAX = 2;
const DEFAULT_LIFESTYLE = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} as const;

export function createStressFixturePrismaClient(
  env: NodeJS.ProcessEnv = process.env,
): StressFixturePrismaClientHandle {
  const connectionString = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  const pool = new Pool({
    connectionString,
    max: STRESS_FIXTURE_POOL_MAX,
    application_name: STRESS_FIXTURE_APPLICATION_NAME,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, {
      schema,
      disposeExternalPool: false,
    }),
  });

  return {
    client: prisma as unknown as StressFixtureMutationClient,
    disconnect: async () => {
      try {
        await prisma.$disconnect();
      } finally {
        await pool.end();
      }
    },
  };
}

export async function materializeStressFixture(
  prisma: StressFixtureMutationClient,
  plan: StressFixturePlan,
  deps: StressFixtureMaterializerDeps = {},
): Promise<StressFixtureMaterializationSummary> {
  assertStressMarker(plan.marker);
  const hashPassword = deps.hashPassword ?? defaultHashPassword;
  const now = deps.now ?? DEFAULT_NOW;
  const passwordHashes = new Map<string, string>();

  for (const actor of plan.actors) {
    if (!passwordHashes.has(actor.password)) {
      passwordHashes.set(actor.password, await hashPassword(actor.password));
    }
  }

  const summary = buildMaterializationSummary(plan);

  await runInTransaction(prisma, async (tx) => {
    await tx.campusMaster.createMany({
      data: [
        {
          code: plan.campus.code,
          nameKo: plan.campus.nameKo,
          isOperated: true,
          sortOrder: 99,
        },
      ],
      skipDuplicates: true,
    });

    await tx.collegeMaster.createMany({
      data: [
        {
          code: collegeCode(plan.marker),
          campusCode: plan.campus.code,
          nameKo: '스트레스 단과대학',
          sortOrder: 99,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });

    await tx.dormitory.createMany({
      data: plan.dormitories.map((dormitory) => ({
        id: dormitory.id,
        campusCode: dormitory.campusCode,
        nameKo: dormitory.nameKo,
        roomType: dormitory.roomType,
        genderPolicy: dormitory.genderPolicy,
        sortOrder: dormitory.sortOrder,
      })),
      skipDuplicates: true,
    });

    await tx.season.upsert({
      where: { id: plan.season.id },
      create: {
        id: plan.season.id,
        campusCode: plan.season.campusCode,
        academicYear: plan.season.academicYear,
        semester: plan.season.semester,
        name: plan.season.name,
        preparationStartDate: dateOnly('2026-01-01'),
        matchingStartDate: dateOnly('2026-01-08'),
        seasonEndDate: dateOnly('2026-12-31'),
      },
      update: {
        name: plan.season.name,
        preparationStartDate: dateOnly('2026-01-01'),
        matchingStartDate: dateOnly('2026-01-08'),
        seasonEndDate: dateOnly('2026-12-31'),
      },
    });

    await tx.seasonDormitoryOperation.createMany({
      data: plan.dormitories.map((dormitory) => ({
        seasonId: plan.season.id,
        dormitoryId: dormitory.id,
        isOperated: true,
        roomSelectionDate: dateOnly('2026-12-15'),
      })),
      skipDuplicates: true,
    });

    await tx.user.createMany({
      data: plan.actors.map((actor) => ({
        id: actor.userId,
        email: actor.email,
        emailNormalized: actor.email.toLowerCase(),
        passwordHash: passwordHashes.get(actor.password) ?? '',
        gender: actor.gender,
        campus: plan.campus.code,
        emailVerifiedAt: now,
      })),
      skipDuplicates: true,
    });

    await tx.userDisplayIdentity.createMany({
      data: plan.actors.map((actor) => ({
        userId: actor.userId,
        nickname: `스트레스${actor.index.toString().padStart(4, '0')}`,
        nicknameNormalized: `${plan.marker}-nickname-${actor.index.toString().padStart(4, '0')}`,
        nicknameChangedAt: null,
      })),
      skipDuplicates: true,
    });

    await tx.userAcademicIdentity.createMany({
      data: plan.actors.map((actor) => ({
        userId: actor.userId,
        collegeCode: collegeCode(plan.marker),
        birthYear: 2000 + (actor.index % 7),
      })),
      skipDuplicates: true,
    });

    await tx.userAcademicIdentityChangeAllowance.createMany({
      data: plan.actors.map((actor) => ({
        userId: actor.userId,
        academicYear: plan.season.academicYear,
        collegeChangeRemaining: 1,
        resetReason: 'INITIAL_CYCLE_ALLOWANCE',
      })),
      skipDuplicates: true,
    });

    await tx.seasonParticipant.createMany({
      data: plan.actors.map((actor) => ({
        id: actor.participantId,
        seasonId: plan.season.id,
        userId: actor.userId,
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: actor.dormitoryId,
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        campusCodeSnapshot: plan.campus.code,
        genderSnapshot: actor.gender,
        joinedAt: now,
        activatedAt: now,
      })),
      skipDuplicates: true,
    });

    await tx.seasonParticipantProfile.createMany({
      data: plan.actors.map((actor) => buildProfileRow(plan, actor, now)),
      skipDuplicates: true,
    });

    await tx.seasonParticipantProfileHistory.createMany({
      data: plan.actors.map((actor) => ({
        id: `${actor.profileId}-history`,
        ...buildProfileRow(plan, actor, now),
        registeredAtSnapshot: now,
        source: 'SEASON_REGISTRATION',
      })),
      skipDuplicates: true,
    });

    await tx.userBookmark.createMany({ data: buildBookmarkRows(plan, now), skipDuplicates: true });
    await tx.matchRequest.createMany({
      data: buildMatchRequestRows(plan, now),
      skipDuplicates: true,
    });
    await tx.conversationThread.createMany({
      data: buildConversationThreadRows(plan, now),
      skipDuplicates: true,
    });
    await tx.conversationThreadMember.createMany({
      data: buildConversationThreadMemberRows(plan),
      skipDuplicates: true,
    });
    await tx.conversationMessage.createMany({
      data: buildConversationMessageRows(plan, now),
      skipDuplicates: true,
    });
    await tx.userNotification.createMany({
      data: buildNotificationRows(plan, now),
      skipDuplicates: true,
    });
    await tx.supportFaqArticle.createMany({
      data: [
        {
          id: `${plan.marker}-support-faq-1`,
          category: 'MATCHING',
          question: '스트레스 테스트 FAQ',
          answer: '로컬/스테이징 부하 테스트용 FAQ입니다.',
          published: true,
          sortOrder: 99,
        },
      ],
      skipDuplicates: true,
    });
    await tx.supportTicket.createMany({
      data: buildSupportTicketRows(plan, now),
      skipDuplicates: true,
    });
    await tx.supportTicketMessage.createMany({
      data: buildSupportTicketMessageRows(plan, now),
      skipDuplicates: true,
    });
    await tx.reportCase.createMany({ data: buildReportRows(plan, now), skipDuplicates: true });
    await tx.reportCaseEvent.createMany({
      data: buildReportEventRows(plan, now),
      skipDuplicates: true,
    });
  });

  return summary;
}

export async function resetStressFixture(
  prisma: StressFixtureMutationClient,
  plan: StressFixturePlan,
): Promise<StressFixtureResetSummary> {
  assertStressMarker(plan.marker);

  const userIds = plan.actors.map((actor) => actor.userId);
  const participantIds = plan.actors.map((actor) => actor.participantId);
  const emails = plan.actors.map((actor) => actor.email.toLowerCase());
  const deleted: { model: string; count: number }[] = [];

  await runInTransaction(prisma, async (tx) => {
    await recordDelete(deleted, 'reportCaseEvent', () =>
      tx.reportCaseEvent.deleteMany({ where: { reportCaseId: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'reportCase', () =>
      tx.reportCase.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'supportTicketMessage', () =>
      tx.supportTicketMessage.deleteMany({ where: { ticketId: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'supportTicket', () =>
      tx.supportTicket.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'supportFaqArticle', () =>
      tx.supportFaqArticle.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'userNotification', () =>
      tx.userNotification.deleteMany({ where: { sourceId: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'conversationMessage', () =>
      tx.conversationMessage.deleteMany({ where: { threadId: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'conversationThreadMember', () =>
      tx.conversationThreadMember.deleteMany({ where: { threadId: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'conversationThread', () =>
      tx.conversationThread.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'matchRequest', () =>
      tx.matchRequest.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'userBookmark', () =>
      tx.userBookmark.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'seasonParticipantProfileHistory', () =>
      tx.seasonParticipantProfileHistory.deleteMany({
        where: { participantId: { in: participantIds } },
      }),
    );
    await recordDelete(deleted, 'seasonParticipantProfile', () =>
      tx.seasonParticipantProfile.deleteMany({ where: { participantId: { in: participantIds } } }),
    );
    await recordDelete(deleted, 'seasonParticipant', () =>
      tx.seasonParticipant.deleteMany({ where: { id: { in: participantIds } } }),
    );
    await recordDelete(deleted, 'authSession', () =>
      tx.authSession.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await recordDelete(deleted, 'authSecurityEvent', () =>
      tx.authSecurityEvent.deleteMany({ where: { actorUserId: { in: userIds } } }),
    );
    await recordDelete(deleted, 'loginAttempt', () =>
      tx.loginAttempt.deleteMany({ where: { emailNormalized: { in: emails } } }),
    );
    await recordDelete(deleted, 'verificationCodeRequestLog', () =>
      tx.verificationCodeRequestLog.deleteMany({ where: { emailNormalized: { in: emails } } }),
    );
    await recordDelete(deleted, 'verificationCode', () =>
      tx.verificationCode.deleteMany({ where: { emailNormalized: { in: emails } } }),
    );
    await recordDelete(deleted, 'userAcademicIdentityChangeAllowance', () =>
      tx.userAcademicIdentityChangeAllowance.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await recordDelete(deleted, 'userAcademicIdentity', () =>
      tx.userAcademicIdentity.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await recordDelete(deleted, 'userDisplayIdentity', () =>
      tx.userDisplayIdentity.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await recordDelete(deleted, 'user', () =>
      tx.user.deleteMany({ where: { id: { in: userIds } } }),
    );
    await recordDelete(deleted, 'season', () =>
      tx.season.deleteMany({ where: { id: plan.season.id } }),
    );
    await recordDelete(deleted, 'dormitory', () =>
      tx.dormitory.deleteMany({ where: { id: startsWith(plan.marker) } }),
    );
    await recordDelete(deleted, 'collegeMaster', () =>
      tx.collegeMaster.deleteMany({ where: { code: collegeCode(plan.marker) } }),
    );
  });

  return {
    mode: 'applied-reset',
    databaseMutation: true,
    marker: plan.marker,
    deleted,
  };
}

export function buildMaterializationSummary(
  plan: StressFixturePlan,
): StressFixtureMaterializationSummary {
  return {
    mode: 'applied',
    databaseMutation: true,
    marker: plan.marker,
    counts: {
      actors: plan.actors.length,
      dormitories: plan.dormitories.length,
      seasonDormitoryOperations: plan.dormitories.length,
      bookmarks: buildBookmarkRows(plan, DEFAULT_NOW).length,
      matchRequests: buildMatchRequestRows(plan, DEFAULT_NOW).length,
      conversationThreads: buildConversationThreadRows(plan, DEFAULT_NOW).length,
      conversationMessages: buildConversationMessageRows(plan, DEFAULT_NOW).length,
      notifications: buildNotificationRows(plan, DEFAULT_NOW).length,
      supportTickets: buildSupportTicketRows(plan, DEFAULT_NOW).length,
      reports: buildReportRows(plan, DEFAULT_NOW).length,
    },
  };
}

export function assertStressMarker(marker: string) {
  if (!marker.includes('stress')) {
    throw new Error('Stress fixture mutation marker must include "stress".');
  }
}

export function buildActorTokenPlan(plan: StressFixturePlan) {
  return plan.actors.map((actor, zeroBasedIndex) => {
    const target = plan.actors[(zeroBasedIndex + 1) % plan.actors.length] ?? actor;
    const threadId =
      actor.role === 'chat-reader'
        ? `${plan.marker}-thread-${actor.index.toString().padStart(4, '0')}`
        : null;
    return {
      index: actor.index,
      actorId: actor.actorId,
      role: actor.role,
      userId: actor.userId,
      participantId: actor.participantId,
      targetUserId: target.userId,
      targetParticipantId: target.participantId,
      threadId,
    };
  });
}

function collegeCode(marker: string) {
  return `${marker}-${DEFAULT_COLLEGE_CODE}`;
}

function buildProfileRow(plan: StressFixturePlan, actor: StressActorPlanRow, _now: Date) {
  const lifestyle = toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE);
  return {
    participantId: actor.participantId,
    seasonId: plan.season.id,
    nicknameSnapshot: `스트레스${actor.index.toString().padStart(4, '0')}`,
    nicknameNormalizedSnapshot: `${plan.marker}-nickname-${actor.index.toString().padStart(4, '0')}`,
    ...lifestyle,
    intro: `부하 테스트용 소개 ${actor.index}`,
    collegeCode: collegeCode(plan.marker),
    grade: String((actor.index % 4) + 1),
    mbti: ['INTJ', 'ENFP', 'ISTP', 'ISFJ'][actor.index % 4],
    birthYear: 2000 + (actor.index % 7),
  };
}

function buildBookmarkRows(plan: StressFixturePlan, now: Date) {
  return plan.actors
    .filter((actor) => actor.index % 4 === 1)
    .map((actor, index) => {
      const target = plan.actors[(actor.index + index) % plan.actors.length] ?? actor;
      return {
        id: `${plan.marker}-bookmark-${actor.index.toString().padStart(4, '0')}`,
        viewerUserId: actor.userId,
        seasonId: plan.season.id,
        targetUserId: target.userId,
        targetParticipantId: target.participantId,
        bookmarkedAt: now,
      };
    })
    .filter((bookmark) => bookmark.viewerUserId !== bookmark.targetUserId);
}

function buildMatchRequestRows(plan: StressFixturePlan, now: Date) {
  return plan.actors
    .filter((actor) => actor.role === 'request-writer')
    .slice(0, Math.max(1, Math.floor(plan.actors.length / 10)))
    .map((actor, index) => {
      const target = plan.actors[(actor.index + index + 1) % plan.actors.length] ?? actor;
      const pair = [actor.participantId, target.participantId].sort();
      return {
        id: `${plan.marker}-match-request-${actor.index.toString().padStart(4, '0')}`,
        seasonId: plan.season.id,
        pairKey: pair.join(':'),
        pairMinParticipantId: pair[0],
        pairMaxParticipantId: pair[1],
        requesterParticipantId: actor.participantId,
        receiverParticipantId: target.participantId,
        note: '스트레스 테스트 매칭 요청',
        status: 'PENDING',
        createdAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      };
    })
    .filter((request) => request.requesterParticipantId !== request.receiverParticipantId);
}

function buildConversationThreadRows(plan: StressFixturePlan, now: Date) {
  return chatActors(plan).map((actor, index) => {
    const target = plan.actors[(actor.index + index + 1) % plan.actors.length] ?? actor;
    const pair = [actor.participantId, target.participantId].sort();
    return {
      id: `${plan.marker}-thread-${actor.index.toString().padStart(4, '0')}`,
      seasonId: plan.season.id,
      pairKey: pair.join(':'),
      participantAId: pair[0],
      participantBId: pair[1],
      openedByParticipantId: actor.participantId,
      threadKind: 'DIRECT',
      status: 'OPEN',
      lastMessageAt: now,
    };
  });
}

function buildConversationThreadMemberRows(plan: StressFixturePlan) {
  return buildConversationThreadRows(plan, DEFAULT_NOW).flatMap((thread) => [
    {
      threadId: thread.id,
      participantId: thread.participantAId,
      memberState: 'ACTIVE',
      lastVisibleAt: DEFAULT_NOW,
    },
    {
      threadId: thread.id,
      participantId: thread.participantBId,
      memberState: 'ACTIVE',
      lastVisibleAt: DEFAULT_NOW,
    },
  ]);
}

function buildConversationMessageRows(plan: StressFixturePlan, now: Date) {
  return buildConversationThreadRows(plan, now).map((thread, index) => ({
    id: `${thread.id}-message-1`,
    threadId: thread.id,
    senderParticipantId: thread.openedByParticipantId,
    clientMessageId: `${thread.id}-client-1`,
    body: `스트레스 테스트 메시지 ${index + 1}`,
    sentAt: now,
  }));
}

function buildNotificationRows(plan: StressFixturePlan, now: Date) {
  return plan.actors
    .filter((actor) => actor.index % 25 === 0)
    .map((actor) => ({
      id: `${plan.marker}-notification-${actor.index.toString().padStart(4, '0')}`,
      recipientUserId: actor.userId,
      actorUserId: actor.userId,
      kind: 'SEASON_SYSTEM_NOTICE',
      sourceType: 'stress-fixture',
      sourceId: `${plan.marker}-notification-source-${actor.index.toString().padStart(4, '0')}`,
      payload: { noticeKey: 'stress-fixture', seasonId: plan.season.id },
      createdAt: now,
    }));
}

function buildSupportTicketRows(plan: StressFixturePlan, now: Date) {
  return plan.actors
    .filter((actor) => actor.role === 'support-light')
    .slice(0, Math.max(1, Math.floor(plan.actors.length / 50)))
    .map((actor) => ({
      id: `${plan.marker}-support-ticket-${actor.index.toString().padStart(4, '0')}`,
      requesterUserId: actor.userId,
      category: 'MATCHING',
      subject: '스트레스 테스트 문의',
      status: 'OPEN',
      relatedEntityId: plan.season.id,
      emailReplyConsent: false,
      lastMessageAt: now,
      createdAt: now,
    }));
}

function buildSupportTicketMessageRows(plan: StressFixturePlan, now: Date) {
  return buildSupportTicketRows(plan, now).map((ticket) => ({
    id: `${ticket.id}-message-1`,
    ticketId: ticket.id,
    senderType: 'USER',
    senderUserId: ticket.requesterUserId,
    body: '스트레스 테스트 문의 본문',
    createdAt: now,
  }));
}

function buildReportRows(plan: StressFixturePlan, now: Date) {
  return plan.actors
    .filter((actor) => actor.index % 40 === 0)
    .map((actor, index) => {
      const target = plan.actors[(actor.index + index + 2) % plan.actors.length] ?? actor;
      return {
        id: `${plan.marker}-report-${actor.index.toString().padStart(4, '0')}`,
        reporterUserId: actor.userId,
        targetType: 'PROFILE',
        targetId: target.userId,
        targetUserId: target.userId,
        targetParticipantId: target.participantId,
        seasonId: plan.season.id,
        reason: 'OTHER',
        riskTier: 'LOW',
        status: 'SUBMITTED',
        detail: '스트레스 테스트 신고 본문',
        evidenceAttachmentIds: [],
        falseReportDisclaimerAcceptedAt: now,
        targetSnapshot: { targetUserId: target.userId, targetParticipantId: target.participantId },
        receivedAt: now,
      };
    })
    .filter((report) => report.reporterUserId !== report.targetUserId);
}

function buildReportEventRows(plan: StressFixturePlan, now: Date) {
  return buildReportRows(plan, now).map((report) => ({
    id: `${report.id}-event-1`,
    reportCaseId: report.id,
    actorUserId: report.reporterUserId,
    actorType: 'USER',
    eventType: 'REPORT_SUBMITTED',
    metadata: { stressFixture: true },
    occurredAt: now,
  }));
}

function chatActors(plan: StressFixturePlan) {
  return plan.actors
    .filter((actor) => actor.role === 'chat-reader')
    .slice(0, Math.max(1, Math.floor(plan.actors.length / 12)));
}

function startsWith(prefix: string) {
  return { startsWith: prefix };
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function runInTransaction<T>(
  prisma: StressFixtureMutationClient,
  callback: (tx: StressFixtureMutationClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction ? prisma.$transaction(callback) : callback(prisma);
}

async function recordDelete(
  deleted: { model: string; count: number }[],
  model: string,
  callback: () => Promise<WriteResult>,
) {
  const result = await callback();
  deleted.push({ model, count: result.count });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.error(
    'Use seed-stress-fixture.ts or reset-stress-fixture.ts to run guarded fixture writes.',
  );
  process.exitCode = 2;
}
