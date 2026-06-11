import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import type { ChatReportTargetContextPort } from '../../../chat/application/ports/chat-report-target-context.port.js';
import { normalizeApiError } from '../../../platform/http/api-error.js';
import { Campus, Gender } from '../../../generated/prisma/enums.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import { ReportTargetContextResolver } from './report-target-context.resolver.js';

const authUser: AuthenticatedUserContext = {
  id: 'user-actor',
  campus: Campus.CHUNCHEON,
  gender: Gender.M,
  sessionId: 'session-1',
  capabilities: [],
};

const actorParticipant = {
  id: 'participant-actor',
  userId: 'user-actor',
  seasonId: 'season-1',
  participantStatus: 'ACTIVE',
  user: { id: 'user-actor', campus: Campus.CHUNCHEON, gender: Gender.M, deletedAt: null },
};

const prisma = {
  seasonParticipant: {
    findFirst: jest.fn(),
  },
  matchRequest: {
    findFirst: jest.fn(),
  },
};

const resolveThreadTarget = jest.fn() as jest.MockedFunction<
  ChatReportTargetContextPort['resolveThreadTarget']
>;
const resolveMessageTarget = jest.fn() as jest.MockedFunction<
  ChatReportTargetContextPort['resolveMessageTarget']
>;

const chatReportTargetContext: ChatReportTargetContextPort = {
  resolveThreadTarget,
  resolveMessageTarget,
};

describe('ReportTargetContextResolver', () => {
  const resolver = new ReportTargetContextResolver(
    prisma as unknown as PrismaService,
    chatReportTargetContext,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.seasonParticipant.findFirst.mockResolvedValue(actorParticipant);
    prisma.matchRequest.findFirst.mockResolvedValue(null);
    resolveThreadTarget.mockResolvedValue({
      threadId: 'thread-1',
      seasonId: 'season-1',
      counterpartUserId: 'user-target',
      counterpartParticipantId: 'participant-target',
      participantAId: 'participant-actor',
      participantBId: 'participant-target',
      threadKind: 'DIRECT',
      status: 'OPEN',
      closedReason: null,
    });
    resolveMessageTarget.mockResolvedValue({
      messageId: 'message-1',
      threadId: 'thread-1',
      seasonId: 'season-1',
      senderUserId: 'user-target',
      senderParticipantId: 'participant-target',
      participantAId: 'participant-actor',
      participantBId: 'participant-target',
      bodyState: 'PLAIN',
      tombstoneReason: null,
    });
  });

  it('CHAT_THREAD target은 chat-owned port로 위임한 뒤 report context로 매핑한다', async () => {
    const tx = {
      ...prisma,
      conversationThread: { findFirst: jest.fn() },
      conversationMessage: { findFirst: jest.fn() },
    };

    await expect(
      resolver.resolve({
        authUser,
        targetType: 'CHAT_THREAD',
        targetId: 'thread-1',
        client: tx as never,
      }),
    ).resolves.toEqual({
      targetType: 'CHAT_THREAD',
      targetId: 'thread-1',
      targetUserId: 'user-target',
      targetParticipantId: 'participant-target',
      targetThreadId: 'thread-1',
      targetMessageId: null,
      targetMatchRequestId: null,
      seasonId: 'season-1',
      status: 'SUBMITTED',
      snapshot: {
        targetKind: 'CHAT_THREAD',
        threadId: 'thread-1',
        threadKind: 'DIRECT',
        status: 'OPEN',
        closedReason: null,
        participantAId: 'participant-actor',
        participantBId: 'participant-target',
      },
    });

    expect(resolveThreadTarget).toHaveBeenCalledWith({
      actorParticipantId: 'participant-actor',
      seasonId: 'season-1',
      threadId: 'thread-1',
      client: tx,
    });
    expect(tx.conversationThread.findFirst).not.toHaveBeenCalled();
    expect(tx.conversationMessage.findFirst).not.toHaveBeenCalled();
  });

  it('CHAT_MESSAGE target은 chat-owned port로 위임한 뒤 raw body 없이 report context로 매핑한다', async () => {
    await expect(
      resolver.resolve({
        authUser,
        targetType: 'CHAT_MESSAGE',
        targetId: 'message-1',
      }),
    ).resolves.toMatchObject({
      targetType: 'CHAT_MESSAGE',
      targetId: 'message-1',
      targetUserId: 'user-target',
      targetParticipantId: 'participant-target',
      targetThreadId: 'thread-1',
      targetMessageId: 'message-1',
      seasonId: 'season-1',
      snapshot: {
        targetKind: 'CHAT_MESSAGE',
        messageId: 'message-1',
        threadId: 'thread-1',
        senderParticipantId: 'participant-target',
        bodyState: 'PLAIN',
        tombstoneReason: null,
        participantAId: 'participant-actor',
        participantBId: 'participant-target',
      },
    });

    expect(resolveMessageTarget).toHaveBeenCalledWith({
      actorParticipantId: 'participant-actor',
      seasonId: 'season-1',
      messageId: 'message-1',
      client: undefined,
    });
  });

  it('chat port가 null을 반환하면 probing-safe target not reportable로 수렴한다', async () => {
    resolveThreadTarget.mockResolvedValue(null);

    try {
      await resolver.resolve({ authUser, targetType: 'CHAT_THREAD', targetId: 'thread-1' });
      throw new Error('expected targetNotReportable error');
    } catch (error) {
      const normalized = normalizeApiError(error);
      expect(normalized).toMatchObject({
        statusCode: 404,
        code: 'REPORT_TARGET_NOT_REPORTABLE',
      });
    }
  });

  it('PROFILE target은 기존 participant query path를 유지한다', async () => {
    prisma.seasonParticipant.findFirst
      .mockResolvedValueOnce(actorParticipant)
      .mockResolvedValueOnce({
        id: 'participant-target',
        userId: 'user-target',
        seasonId: 'season-1',
        participantStatus: 'ACTIVE',
        dormitoryId: 'dorm-1',
        profile: { participantId: 'participant-target', nicknameSnapshot: 'target' },
      });

    await expect(
      resolver.resolve({ authUser, targetType: 'PROFILE', targetId: 'user-target' }),
    ).resolves.toMatchObject({
      targetType: 'PROFILE',
      targetUserId: 'user-target',
      targetParticipantId: 'participant-target',
      targetThreadId: null,
      targetMessageId: null,
    });

    expect(resolveThreadTarget).not.toHaveBeenCalled();
    expect(resolveMessageTarget).not.toHaveBeenCalled();
  });
});
