import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useAccountLifecycleIntegrationFixture } from '../_support/account-lifecycle.fixture.js';

describe('account deletion and registration race integration', () => {
  const fixture = useAccountLifecycleIntegrationFixture('delete_register_race');

  it('계정 삭제와 registration finalize가 동시에 실행되어도 삭제 계정과 등록 완료 participant가 동시에 남지 않는다', async () => {
    const userId = 'delete-register-race-user';
    const participantId = 'delete-register-race-participant';
    const email = 'delete-register-race@kangwon.ac.kr';
    await fixture.seedRegistrationReadyDraftUser({
      userId,
      participantId,
      email,
      nickname: '삭제등록경합',
    });
    const accessToken = await fixture.issueAccessToken(userId, email);

    const [deleteResponse, registrationResponse] = await Promise.all([
      request(fixture.httpServer)
        .post('/api/users/me/delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'Pass1234' }),
      request(fixture.httpServer)
        .post('/api/seasons/current/participation/registration')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}),
    ]);

    const deletionSucceeded = deleteResponse.status === 201;
    const registrationSucceeded = registrationResponse.status === 201;
    expect(Number(deletionSucceeded) + Number(registrationSucceeded)).toBe(1);

    const [user, participant, historyCount] = await Promise.all([
      fixture.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      fixture.prisma.seasonParticipant.findUniqueOrThrow({ where: { id: participantId } }),
      fixture.prisma.seasonParticipantProfileHistory.count({
        where: { participantId, source: 'SEASON_REGISTRATION' },
      }),
    ]);
    const registrationComplete =
      participant.participationIntent === 'REGISTERED' &&
      participant.registeredAt !== null &&
      participant.dormitorySelectionState === 'ASSIGNED' &&
      participant.dormitoryId !== null;

    expect(user.deletedAt !== null && registrationComplete).toBe(false);

    if (deletionSucceeded) {
      expect(user.deletedAt).not.toBeNull();
      expect(registrationComplete).toBe(false);
      expect(historyCount).toBe(0);
    }

    if (registrationSucceeded) {
      expect(user.deletedAt).toBeNull();
      expect(registrationComplete).toBe(true);
      expect(historyCount).toBe(1);
      expect(deleteResponse.body).toMatchObject({
        code: 'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
      });
    }
  });
});
