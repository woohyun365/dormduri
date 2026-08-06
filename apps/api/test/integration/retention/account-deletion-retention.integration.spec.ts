import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useAccountLifecycleIntegrationFixture } from '../_support/account-lifecycle.fixture.js';

describe('account deletion retention integration', () => {
  const fixture = useAccountLifecycleIntegrationFixture('delete_retention');

  it('비참여 사용자의 삭제 요청은 즉시 비식별화하고 5일 후 retained identity anchor를 폐기한다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저다',
    });
    const accessToken = await fixture.issueAccessToken('user-c', 'user-c@kangwon.ac.kr');

    const requestDelete = await request(fixture.httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);
    const requestDeleteBody = requestDelete.body as {
      state: string;
      deletedAt: string;
      retentionHoldUntil: string;
    };
    expect(requestDeleteBody.state).toBe('DEIDENTIFIED_RETAINED');
    expect(requestDeleteBody.deletedAt).toBeTruthy();
    expect(requestDeleteBody.retentionHoldUntil).toBeTruthy();

    const user = await fixture.prisma.user.findUniqueOrThrow({ where: { id: 'user-c' } });
    expect(user.deletedAt).not.toBeNull();
    expect(user.emailNormalized.startsWith('deleted+')).toBe(true);
    expect(user.emailVerifiedAt).toBeNull();

    const displayIdentity = await fixture.prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-c' },
    });
    expect(displayIdentity.nickname).toBe('탈퇴한 사용자');
    expect(displayIdentity.nicknameNormalized.startsWith('deleted-')).toBe(true);

    await expect(
      fixture.prisma.userAcademicIdentity.findUnique({ where: { userId: 'user-c' } }),
    ).resolves.toBeNull();
    await expect(
      fixture.prisma.userAcademicIdentityChangeAllowance.findUnique({
        where: { userId: 'user-c' },
      }),
    ).resolves.toBeNull();

    const retainedIdentity = await fixture.prisma.retainedIdentity.findUniqueOrThrow({
      where: { originalUserId: 'user-c' },
    });
    const retainedIdentityHold = await fixture.prisma.retainedIdentityHold.findFirstOrThrow({
      where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
      include: { retentionCase: true },
    });
    expect(retainedIdentityHold.retentionCase.reason).toBe('ACCOUNT_DELETION');
    expect(retainedIdentityHold.holdUntil?.toISOString()).toBe(
      requestDeleteBody.retentionHoldUntil,
    );

    const nicknameEvent =
      await fixture.prisma.userDisplayIdentityNicknameChangeEvent.findFirstOrThrow({
        where: {
          userId: 'user-c',
          source: 'ACCOUNT_DELETION_DEIDENTIFICATION',
        },
      });
    expect(nicknameEvent).toMatchObject({
      retainedIdentityId: retainedIdentity.id,
      reason: 'ACCOUNT_DELETION',
      actorType: 'SYSTEM',
      actorId: 'account-deletion',
      previousNickname: '유저다',
      previousNicknameNormalized: '유저다',
      nextNickname: '탈퇴한 사용자',
      nextNicknameNormalized: displayIdentity.nicknameNormalized,
    });

    const archiveJobs = await fixture.prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(archiveJobs.map((job) => job.target).sort()).toEqual([
      'ACADEMIC_IDENTITY_AUDIT',
      'NICKNAME_AUDIT',
    ]);

    await request(fixture.httpServer)
      .post('/api/users/me/delete/cancel')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    await request(fixture.httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    const sixDaysLater = new Date(
      new Date(requestDeleteBody.deletedAt).getTime() + 6 * 24 * 60 * 60 * 1_000,
    );
    const sweepResult = await fixture.lifecycleSweepService.runSweep(sixDaysLater);
    expect(sweepResult.archiveJobSweep.succeededCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.retainedIdentityDisposalSweep.processedCount).toBe(2);

    const disposedIdentity = await fixture.prisma.retainedIdentity.findUniqueOrThrow({
      where: { id: retainedIdentity.id },
    });
    expect(disposedIdentity.originalUserId).toBeNull();
    expect(disposedIdentity.emailHash).toBeNull();
    expect(disposedIdentity.encryptedIdentifierPayload).toBeNull();
    expect(disposedIdentity.identifierKeyVersion).toBeNull();
    expect(disposedIdentity.retentionDisposalReason).toBe('RETENTION_HOLD_EXPIRED');

    const disposalLog = await fixture.prisma.retentionAccessLog.findFirst({
      where: {
        retainedIdentityId: retainedIdentity.id,
        targetType: 'IDENTITY_ANCHOR',
        result: 'DISPOSED',
      },
    });
    expect(disposalLog).not.toBeNull();

    const completedArchiveJobs = await fixture.prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
    });
    expect(completedArchiveJobs.every((job) => job.status === 'SUCCEEDED')).toBe(true);
  });

  it('정상 계정 삭제는 season profile history retention snapshot을 자동 생성하지 않는다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-no-history',
      email: 'user-no-history@kangwon.ac.kr',
      nickname: '히스토리없음',
    });
    const accessToken = await fixture.issueAccessToken(
      'user-no-history',
      'user-no-history@kangwon.ac.kr',
    );

    await request(fixture.httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);

    const seasonHistoryCount = await fixture.prisma.seasonParticipantProfileHistory.count();
    expect(seasonHistoryCount).toBe(0);

    const retainedIdentity = await fixture.prisma.retainedIdentity.findFirstOrThrow({
      where: { originalUserId: 'user-no-history' },
    });
    await expect(
      fixture.prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
      }),
    ).resolves.toMatchObject({ holdReason: 'ACCOUNT_DELETION' });
  });
});
