import { toCompleteLifestyleColumnData } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import type { MatchRequestRecord } from '../persistence/match-request.select.js';
import { toMatchRequestSummary } from './match-request.presenter.js';

const COMPLETE_LIFESTYLE = {
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
  indoorEatingTolerance: 'NO_SMELL',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
} as const;

function makeRequestParticipant(input: {
  userId: string;
  nicknameSnapshot?: string;
  intro?: string;
  profileMissing?: boolean;
}): MatchRequestRecord['requesterParticipant'] {
  return {
    userId: input.userId,
    registeredAt: new Date('2026-02-01T00:00:00.000Z'),
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participationIntent: 'REGISTERED',
    declinedAt: null,
    participantStatus: 'ACTIVE',
    withdrawnAt: null,
    hiddenByAdminAt: null,
    deactivatedAt: null,
    user: { deletedAt: null },
    profile: input.profileMissing
      ? null
      : {
          nicknameSnapshot: input.nicknameSnapshot ?? input.userId,
          intro: input.intro ?? '',
          ...toCompleteLifestyleColumnData(COMPLETE_LIFESTYLE),
        },
  };
}

describe('match request presenter', () => {
  it('request summary는 viewer 기준으로 SENT/RECEIVED counterpart를 정렬한다', () => {
    const request: MatchRequestRecord = {
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: '안녕하세요',
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requesterParticipant: makeRequestParticipant({
        userId: 'user-1',
        nicknameSnapshot: '요청자',
        intro: '요청자 소개',
      }),
      receiverParticipant: makeRequestParticipant({
        userId: 'user-2',
        nicknameSnapshot: '수신자',
        intro: '수신자 소개',
      }),
    };

    const sentSummary = toMatchRequestSummary(request, 'participant-1');
    expect(sentSummary).toMatchObject({
      direction: 'SENT',
      counterpartUserId: 'user-2',
      counterpartParticipantId: 'participant-2',
    });
    expect(sentSummary.counterpartSummary.id).toBe('user-2');
    expect(sentSummary.counterpartSummary.profileSummary.nickname).toBe('수신자');

    const receivedSummary = toMatchRequestSummary(request, 'participant-2');
    expect(receivedSummary).toMatchObject({
      direction: 'RECEIVED',
      counterpartUserId: 'user-1',
      counterpartParticipantId: 'participant-1',
    });
    expect(receivedSummary.counterpartSummary.id).toBe('user-1');
    expect(receivedSummary.counterpartSummary.profileSummary.nickname).toBe('요청자');
  });

  it('request summary는 profile missing을 삭제 사용자 tombstone label로 위장하지 않는다', () => {
    const request: MatchRequestRecord = {
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: null,
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requesterParticipant: makeRequestParticipant({ userId: 'user-1', profileMissing: true }),
      receiverParticipant: makeRequestParticipant({ userId: 'user-2', profileMissing: true }),
    };

    const summary = toMatchRequestSummary(request, 'participant-2');

    expect(summary.counterpartSummary.profileSummary.nickname).toBe('프로필 확인 불가');
    expect(summary.counterpartSummary.profileSummary.nickname).not.toBe('탈퇴한 사용자');
  });
});
