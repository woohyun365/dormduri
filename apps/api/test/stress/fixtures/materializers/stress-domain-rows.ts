import { toCompleteLifestyleColumnData } from '../../../../src/season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type { StressActorPlanRow, StressFixturePlan } from '../stress-fixture.plan.js';

const DEFAULT_COLLEGE_CODE = 'stress-college';
const DEFAULT_NOW = new Date('2026-06-15T00:00:00.000Z');
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

export function collegeCode(marker: string) {
  return `${marker}-${DEFAULT_COLLEGE_CODE}`;
}

export function buildProfileRow(plan: StressFixturePlan, actor: StressActorPlanRow, _now: Date) {
  return {
    participantId: actor.participantId,
    nicknameSnapshot: `스트레스${actor.index.toString().padStart(4, '0')}`,
    nicknameNormalizedSnapshot: `${plan.marker}-nickname-${actor.index.toString().padStart(4, '0')}`,
    ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
    intro: `부하 테스트용 소개 ${actor.index}`,
    collegeCode: collegeCode(plan.marker),
    grade: gradeValueForActor(actor.index),
    mbti: ['INTJ', 'ENFP', 'ISTP', 'ISFJ'][actor.index % 4],
    birthYear: 2000 + (actor.index % 7),
  };
}

function gradeValueForActor(index: number) {
  const grade = (index % 4) + 1;
  return grade >= 4 ? '4+' : String(grade);
}

export function buildBookmarkRows(plan: StressFixturePlan, now: Date) {
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

export function buildMatchRequestRows(plan: StressFixturePlan, now: Date) {
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

function chatActors(plan: StressFixturePlan) {
  return plan.actors
    .filter((actor) => actor.role === 'chat-reader')
    .slice(0, Math.max(1, Math.floor(plan.actors.length / 12)));
}

export function buildConversationThreadRows(plan: StressFixturePlan, now: Date) {
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

export function buildConversationThreadMemberRows(plan: StressFixturePlan) {
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

export function buildConversationMessageRows(plan: StressFixturePlan, now: Date) {
  return buildConversationThreadRows(plan, now).map((thread, index) => ({
    id: `${thread.id}-message-1`,
    threadId: thread.id,
    senderParticipantId: thread.openedByParticipantId,
    clientMessageId: `${thread.id}-client-1`,
    body: `스트레스 테스트 메시지 ${index + 1}`,
    sentAt: now,
  }));
}

export function buildNotificationRows(plan: StressFixturePlan, now: Date) {
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

export function buildSupportTicketRows(plan: StressFixturePlan, now: Date) {
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

export function buildSupportTicketMessageRows(plan: StressFixturePlan, now: Date) {
  return buildSupportTicketRows(plan, now).map((ticket) => ({
    id: `${ticket.id}-message-1`,
    ticketId: ticket.id,
    senderType: 'USER',
    senderUserId: ticket.requesterUserId,
    body: '스트레스 테스트 문의 본문',
    createdAt: now,
  }));
}

export function buildReportRows(plan: StressFixturePlan, now: Date) {
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

export function buildReportEventRows(plan: StressFixturePlan, now: Date) {
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

export function startsWith(prefix: string) {
  return { startsWith: prefix };
}
export function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
