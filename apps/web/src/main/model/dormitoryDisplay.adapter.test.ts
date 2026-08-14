import { describe, expect, it } from 'vitest';
import { getDormitoryDisplayFromSeasonOperations } from './dormitoryDisplay.adapter';

describe('dormitoryDisplay adapter', () => {
  it('시즌 API가 제공한 공개 표시 정보만 사용한다', () => {
    const dormitory = getDormitoryDisplayFromSeasonOperations('dasan', [
      {
        dormitoryId: 'dasan',
        dormitory: {
          id: 'dasan',
          name: '다산관',
          roomType: 2,
          genderPolicy: 'M',
        },
        isOperated: true,
        roomSelectionDate: '2026-08-06',
      },
    ]);

    expect(dormitory).toEqual({
      id: 'dasan',
      name: '다산관',
      roomType: 2,
      genderPolicy: 'M',
    });
  });

  it('API 표시 정보가 없으면 FE 카탈로그를 추측하지 않는다', () => {
    expect(
      getDormitoryDisplayFromSeasonOperations('dasan', [
        {
          dormitoryId: 'dasan',
          isOperated: true,
          roomSelectionDate: '2026-08-06',
        },
      ]),
    ).toBeNull();
  });
});
