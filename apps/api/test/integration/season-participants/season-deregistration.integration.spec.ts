import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { seedActiveMatchFixture } from '../_support/fixtures/matches.fixture.js';
import { useAccountLifecycleIntegrationFixture } from '../_support/account-lifecycle.fixture.js';

describe('season de-registration integration', () => {
  const fixture = useAccountLifecycleIntegrationFixture('season_deregister');

  it('season de-registration은 pending request와 direct thread를 withdrawn reason으로 정리하고 재참여를 막는다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
      withParticipant: true,
    });
    await fixture.seedVerifiedUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
      withParticipant: true,
    });

    await fixture.prisma.matchRequest.create({
      data: {
        id: 'pending-request',
        seasonId: 'season-integration',
        pairKey: 'user-a-participant:user-b-participant',
        pairMinParticipantId: 'user-a-participant',
        pairMaxParticipantId: 'user-b-participant',
        requesterParticipantId: 'user-a-participant',
        receiverParticipantId: 'user-b-participant',
        status: 'PENDING',
        expiresAt: new Date((await fixture.prisma.getDatabaseNow()).getTime() + 60 * 60 * 1_000),
      },
    });

    await fixture.prisma.conversationThread.create({
      data: {
        id: 'direct-thread',
        seasonId: 'season-integration',
        pairKey: 'user-a-participant:user-b-participant',
        participantAId: 'user-a-participant',
        participantBId: 'user-b-participant',
        openedByParticipantId: 'user-a-participant',
        threadKind: 'DIRECT',
        status: 'OPEN',
      },
    });

    const accessToken = await fixture.issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const response = await request(fixture.httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const body = response.body as { participationIntent: string; participantStatus: string };
    expect(body.participationIntent).toBe('DECLINED');
    expect(body.participantStatus).toBe('WITHDRAWN');

    const participant = await fixture.prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'user-a-participant' },
    });
    expect(participant.participationIntent).toBe('DECLINED');
    expect(participant.participantStatus).toBe('WITHDRAWN');
    expect(participant.withdrawnAt).not.toBeNull();

    const pendingRequest = await fixture.prisma.matchRequest.findUniqueOrThrow({
      where: { id: 'pending-request' },
    });
    expect(pendingRequest.status).toBe('CANCELLED_BY_SYSTEM');
    expect(pendingRequest.terminalReason).toBe('WITHDRAWN_PARTICIPANT');

    const thread = await fixture.prisma.conversationThread.findUniqueOrThrow({
      where: { id: 'direct-thread' },
    });
    expect(thread.status).toBe('READ_ONLY');
    expect(thread.closedReason).toBe('PARTICIPANT_WITHDRAWN');

    await request(fixture.httpServer)
      .post('/api/seasons/current/participation/registration')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('메시지가 있는 direct thread는 참여 철회 후 read-only가 되고 계정 삭제 후에도 탈퇴 사용자 표시와 함께 유지된다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
      withParticipant: true,
    });
    await fixture.seedVerifiedUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
      withParticipant: true,
    });

    await fixture.prisma.conversationThread.create({
      data: {
        id: 'direct-thread-with-message',
        seasonId: 'season-integration',
        pairKey: 'user-a-participant:user-b-participant',
        participantAId: 'user-a-participant',
        participantBId: 'user-b-participant',
        openedByParticipantId: 'user-a-participant',
        threadKind: 'DIRECT',
        status: 'OPEN',
        lastMessageAt: new Date('2026-05-01T01:00:00.000Z'),
        members: {
          createMany: {
            data: [
              { participantId: 'user-a-participant' },
              { participantId: 'user-b-participant' },
            ],
          },
        },
        messages: {
          create: [
            {
              id: 'message-a-to-b-before-withdrawal',
              senderParticipantId: 'user-a-participant',
              body: '철회 전 A가 보낸 메시지',
              sentAt: new Date('2026-05-01T01:00:00.000Z'),
            },
            {
              id: 'message-b-to-a-before-withdrawal',
              senderParticipantId: 'user-b-participant',
              body: '철회 전 B가 보낸 메시지',
              sentAt: new Date('2026-05-01T01:01:00.000Z'),
            },
          ],
        },
      },
    });

    const userAAccessToken = await fixture.issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const userBAccessToken = await fixture.issueAccessToken('user-b', 'user-b@kangwon.ac.kr');

    await request(fixture.httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${userAAccessToken}`)
      .expect(201);

    const threadAfterDeregistration = await fixture.prisma.conversationThread.findUniqueOrThrow({
      where: { id: 'direct-thread-with-message' },
    });
    expect(threadAfterDeregistration.status).toBe('READ_ONLY');
    expect(threadAfterDeregistration.closedReason).toBe('PARTICIPANT_WITHDRAWN');
    expect(threadAfterDeregistration.closedAt).not.toBeNull();

    const detailAfterDeregistration = await request(fixture.httpServer)
      .get('/api/chat/threads/direct-thread-with-message')
      .set('Authorization', `Bearer ${userBAccessToken}`)
      .expect(200);
    const detailAfterDeregistrationBody = detailAfterDeregistration.body as {
      thread: { status: string; closedReason: string | null; canSendMessage: boolean };
      messages: Array<{ id: string; body: string; senderUserId: string }>;
    };
    expect(detailAfterDeregistrationBody.thread).toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'PARTICIPANT_WITHDRAWN',
      canSendMessage: false,
    });
    expect(detailAfterDeregistrationBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-a-to-b-before-withdrawal',
          senderUserId: 'user-a',
          body: '철회 전 A가 보낸 메시지',
        }),
        expect.objectContaining({
          id: 'message-b-to-a-before-withdrawal',
          senderUserId: 'user-b',
          body: '철회 전 B가 보낸 메시지',
        }),
      ]),
    );

    await request(fixture.httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${userAAccessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);

    const threadAfterDeletion = await fixture.prisma.conversationThread.findUniqueOrThrow({
      where: { id: 'direct-thread-with-message' },
    });
    expect(threadAfterDeletion.status).toBe('READ_ONLY');
    expect(threadAfterDeletion.closedReason).toBe('PARTICIPANT_WITHDRAWN');

    const anonymizedIdentity = await fixture.prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(anonymizedIdentity.nickname).toBe('탈퇴한 사용자');
    expect(anonymizedIdentity.nicknameNormalized.startsWith('deleted-')).toBe(true);

    const retainedIdentity = await fixture.prisma.retainedIdentity.findUniqueOrThrow({
      where: { originalUserId: 'user-a' },
    });
    expect(retainedIdentity.displayLabel).toBe('탈퇴한 사용자');
    await expect(
      fixture.prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
        include: { retentionCase: true },
      }),
    ).resolves.toMatchObject({
      holdReason: 'ACCOUNT_DELETION',
      retentionCase: { reason: 'ACCOUNT_DELETION' },
    });
    const archiveJobs = await fixture.prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(archiveJobs.map((job) => job.target)).toEqual(
      expect.arrayContaining([
        'ACADEMIC_IDENTITY_AUDIT',
        'SEASON_PROFILE_HISTORY',
        'THREAD_RETENTION',
        'NICKNAME_AUDIT',
      ]),
    );
    expect(archiveJobs).toHaveLength(4);
    const threadRetentionJob = archiveJobs.find((job) => job.target === 'THREAD_RETENTION');
    expect(threadRetentionJob).toMatchObject({
      threadId: 'direct-thread-with-message',
      status: 'WAITING_CONDITION',
    });

    const detailAfterDeletion = await request(fixture.httpServer)
      .get('/api/chat/threads/direct-thread-with-message')
      .set('Authorization', `Bearer ${userBAccessToken}`)
      .expect(200);
    const detailAfterDeletionBody = detailAfterDeletion.body as {
      thread: { status: string; closedReason: string | null; canSendMessage: boolean };
      messages: Array<{ id: string; body: string; senderUserId: string }>;
    };
    expect(detailAfterDeletionBody.thread).toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'PARTICIPANT_WITHDRAWN',
      canSendMessage: false,
    });
    expect(detailAfterDeletionBody.messages.map((message) => message.id)).toEqual([
      'message-a-to-b-before-withdrawal',
      'message-b-to-a-before-withdrawal',
    ]);
  });

  it('live active match가 있는 참여자는 season de-registration을 거부한다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
      withParticipant: true,
    });
    await fixture.seedVerifiedUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저나',
      withParticipant: true,
    });
    await seedActiveMatchFixture(fixture.prisma, {
      activeMatchId: 'active-a-b',
      participantAId: 'user-a-participant',
      participantBId: 'user-b-participant',
      withMatchedThread: true,
    });

    const accessToken = await fixture.issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const response = await request(fixture.httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    expect((response.body as { code: string }).code).toBe(
      'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED',
    );

    const participant = await fixture.prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'user-a-participant' },
    });
    expect(participant.participationIntent).toBe('REGISTERED');
    expect(participant.participantStatus).toBe('MATCHED');
    expect(participant.withdrawnAt).toBeNull();
  });

  it('SEASON_POST_MATCH에서는 live match가 없어도 season de-registration을 거부한다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
      withParticipant: true,
    });
    await fixture.prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'SEASON_POST_MATCH',
        overrideStartedAt: await fixture.prisma.getDatabaseNow(),
        overrideEndsAt: null,
      },
    });

    const accessToken = await fixture.issueAccessToken('user-a', 'user-a@kangwon.ac.kr');
    const response = await request(fixture.httpServer)
      .post('/api/seasons/current/participation/deregister')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    expect((response.body as { code: string }).code).toBe(
      'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED',
    );

    const participant = await fixture.prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: 'user-a-participant' },
    });
    expect(participant.participationIntent).toBe('REGISTERED');
    expect(participant.participantStatus).toBe('ACTIVE');
    expect(participant.withdrawnAt).toBeNull();
  });
});
