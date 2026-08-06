import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useAccountLifecycleIntegrationFixture } from '../_support/account-lifecycle.fixture.js';

describe('account deletion integration', () => {
  const fixture = useAccountLifecycleIntegrationFixture('account_delete');

  it('current season registered participant는 계정 삭제 요청 대신 시즌 참여 철회 또는 시즌 종료 후 재시도를 안내받는다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저가',
      withParticipant: true,
    });
    const accessToken = await fixture.issueAccessToken('user-a', 'user-a@kangwon.ac.kr');

    const response = await request(fixture.httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(409);

    const body = response.body as { code: string; seasonState: string };
    expect(body.code).toBe('ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION');
    expect(body.seasonState).toBe('SEASON_MATCHING');
  });

  it('계정 삭제 요청은 현재 비밀번호가 틀리면 계정을 비식별화하지 않는다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-password-mismatch',
      email: 'password-mismatch@kangwon.ac.kr',
      nickname: '비밀번호검증유저',
    });
    const accessToken = await fixture.issueAccessToken(
      'user-password-mismatch',
      'password-mismatch@kangwon.ac.kr',
    );

    const response = await request(fixture.httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Wrong1234' })
      .expect(400);

    expect((response.body as { code: string }).code).toBe('ACCOUNT_DELETION_PASSWORD_MISMATCH');
    const user = await fixture.prisma.user.findUniqueOrThrow({
      where: { id: 'user-password-mismatch' },
    });
    expect(user.deletedAt).toBeNull();
  });

  it('등록 전 season profile draft는 계정 삭제 수락 시 current profile 식별/생활패턴 필드를 비식별화한다', async () => {
    await fixture.seedVerifiedUser({
      userId: 'user-draft-profile',
      email: 'draft-profile@kangwon.ac.kr',
      nickname: '드래프트유저',
    });
    await fixture.prisma.seasonParticipant.create({
      data: {
        id: 'user-draft-profile-participant',
        seasonId: 'season-integration',
        userId: 'user-draft-profile',
        participationIntent: 'UNDECIDED',
        dormitorySelectionState: 'NOT_SELECTED',
        participantStatus: 'DRAFT',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
      },
    });
    await fixture.prisma.seasonParticipantProfile.create({
      data: {
        participantId: 'user-draft-profile-participant',
        nicknameSnapshot: '드래프트유저',
        nicknameNormalizedSnapshot: '드래프트유저',
        bedtime: 'BETWEEN_22_24',
        wakeTime: 'BETWEEN_07_08',
        smokingBehavior: 'NO',
        relationshipStyle: 'CLOSE',
        intro: '등록 전 소개',
        grade: '2',
        mbti: 'INTJ',
        birthYear: 2000,
      },
    });
    const accessToken = await fixture.issueAccessToken(
      'user-draft-profile',
      'draft-profile@kangwon.ac.kr',
    );

    await request(fixture.httpServer)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Pass1234' })
      .expect(201);

    const draftProfile = await fixture.prisma.seasonParticipantProfile.findUniqueOrThrow({
      where: { participantId: 'user-draft-profile-participant' },
    });
    expect(draftProfile.nicknameSnapshot).toBe('탈퇴한 사용자');
    expect(draftProfile.nicknameNormalizedSnapshot.startsWith('deleted-')).toBe(true);
    expect(draftProfile.intro).toBe('');
    expect(draftProfile.bedtime).toBeNull();
    expect(draftProfile.wakeTime).toBeNull();
    expect(draftProfile.smokingBehavior).toBeNull();
    expect(draftProfile.relationshipStyle).toBeNull();
    expect(draftProfile.collegeCode).toBeNull();
    expect(draftProfile.grade).toBeNull();
    expect(draftProfile.mbti).toBeNull();
    expect(draftProfile.birthYear).toBeNull();

    const seasonHistoryCount = await fixture.prisma.seasonParticipantProfileHistory.count({
      where: { participantId: 'user-draft-profile-participant' },
    });
    expect(seasonHistoryCount).toBe(0);
  });
});
