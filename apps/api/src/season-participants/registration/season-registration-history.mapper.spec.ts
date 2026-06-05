import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import {
  currentProfile,
  now,
  participant,
} from '../test-support/season-participants.spec-fixtures.js';
import { toSeasonProfileHistoryCreateData } from './season-registration-history.mapper.js';

describe('season-registration-history.mapper', () => {
  it('registeredAtSnapshot과 registration source를 history create data에 고정한다', () => {
    const data = toSeasonProfileHistoryCreateData(
      participant({
        seasonId: 'season-1',
        profile: currentProfile({
          nicknameSnapshot: '등록닉네임',
          nicknameNormalizedSnapshot: '등록닉네임',
          collegeCode: 'NURSING',
          birthYear: 2001,
        }),
      }) as never,
      now,
    );

    expect(data).toMatchObject({
      participantId: 'participant-1',
      seasonId: 'season-1',
      nicknameSnapshot: '등록닉네임',
      nicknameNormalizedSnapshot: '등록닉네임',
      collegeCode: 'NURSING',
      birthYear: 2001,
      registeredAtSnapshot: now,
      source: 'SEASON_REGISTRATION',
    });
  });

  it('profile 없는 participant는 history mapper에서 incomplete error로 닫는다', () => {
    let thrown: unknown;

    try {
      toSeasonProfileHistoryCreateData(participant({ profile: null }) as never, now);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      response: seasonParticipantsErrors.registrationSeasonProfileIncomplete().getResponse(),
    });
  });
});
