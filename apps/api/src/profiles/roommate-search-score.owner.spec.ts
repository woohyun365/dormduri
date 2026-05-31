import { completeLifestyle } from '../season-participants/season-participants.owner.spec-fixtures.js';
import { calculateQueryTimeRoommateSearchScore } from './roommate-search-score.owner.js';

describe('roommate-search-score.owner', () => {
  it('scoreVisible target은 request 시점의 viewer/target lifestyle로 query-time score를 계산한다', () => {
    const result = calculateQueryTimeRoommateSearchScore({
      viewerLifestyle: completeLifestyle,
      targetLifestyle: {
        ...completeLifestyle,
        drinkingFrequency: 'OFTEN',
      },
      scoreVisible: true,
    });

    expect(result).toEqual(expect.any(Number));
  });

  it('score exposure가 닫히거나 lifestyle이 incomplete이면 score를 만들지 않는다', () => {
    expect(
      calculateQueryTimeRoommateSearchScore({
        viewerLifestyle: completeLifestyle,
        targetLifestyle: completeLifestyle,
        scoreVisible: false,
      }),
    ).toBeNull();

    expect(
      calculateQueryTimeRoommateSearchScore({
        viewerLifestyle: completeLifestyle,
        targetLifestyle: {
          ...completeLifestyle,
          bedtime: null,
        },
        scoreVisible: true,
      }),
    ).toBeNull();
  });
});
