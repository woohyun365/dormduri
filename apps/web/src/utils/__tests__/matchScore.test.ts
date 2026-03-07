import { describe, it, expect } from 'vitest';
import { calcMatchScore, indexDistance, BEDTIME_ORDER, WAKE_ORDER } from '../matchScore';
import {
  makeLifestyle,
  LIFESTYLE_IDENTICAL,
  LIFESTYLE_OPPOSITE,
  LIFESTYLE_EMPTY,
} from '@/__fixtures__/test-helpers';
import { mockRawProfiles } from '@/__fixtures__/profiles';

// -- indexDistance --

describe('indexDistance', () => {
  it('같은 위치면 0', () => {
    expect(indexDistance(BEDTIME_ORDER, '22_24', '22_24')).toBe(0);
  });

  it('인접하면 1', () => {
    expect(indexDistance(BEDTIME_ORDER, '22_24', '24_02')).toBe(1);
  });

  it('2칸 차이', () => {
    expect(indexDistance(BEDTIME_ORDER, 'BEFORE_22', '24_02')).toBe(2);
  });

  it('양 끝 최대 거리', () => {
    expect(indexDistance(BEDTIME_ORDER, 'BEFORE_22', 'AFTER_02')).toBe(3);
  });

  it('순서 무관 (절대값)', () => {
    expect(indexDistance(WAKE_ORDER, 'AFTER_10', 'BEFORE_06')).toBe(3);
  });

  it('존재하지 않는 값이면 -1', () => {
    expect(indexDistance(BEDTIME_ORDER, 'INVALID', '22_24')).toBe(-1);
  });

  it('양쪽 모두 존재하지 않으면 -1', () => {
    expect(indexDistance(BEDTIME_ORDER, 'X', 'Y')).toBe(-1);
  });
});

// -- calcMatchScore --

describe('calcMatchScore', () => {
  // 8필드 × 12.5점 = 100점 만점

  describe('기본 케이스', () => {
    it('동일한 라이프스타일 -> 100점', () => {
      expect(calcMatchScore(LIFESTYLE_IDENTICAL, LIFESTYLE_IDENTICAL)).toBe(100);
    });

    it('양쪽 모두 null -> 100점 (null은 관대 처리)', () => {
      expect(calcMatchScore(LIFESTYLE_EMPTY, LIFESTYLE_EMPTY)).toBe(100);
    });

    it('한쪽만 전부 null -> 100점', () => {
      expect(calcMatchScore(LIFESTYLE_IDENTICAL, LIFESTYLE_EMPTY)).toBe(100);
      expect(calcMatchScore(LIFESTYLE_EMPTY, LIFESTYLE_IDENTICAL)).toBe(100);
    });
  });

  describe('정반대 라이프스타일', () => {
    // DEFAULT vs OPPOSITE 수동 계산:
    // smoker: NO vs YES -> 0
    // sleepHabit: NONE vs SNORING -> 0
    // indoorEating: OK vs NO -> OK 있으므로 12.5
    // bedtime: 22_24 vs AFTER_02 -> dist=2 -> 0
    // wakeTime: 06_08 vs AFTER_10 -> dist=2 -> 0
    // noiseSensitivity: MID vs LOW -> dist=1 -> 6.25
    // cleanliness: MID vs LOW -> dist=1 -> 6.25
    // relationshipStyle: CASUAL vs CLOSE -> 0
    // 합계: 25
    it('정반대 -> 25점', () => {
      expect(calcMatchScore(LIFESTYLE_IDENTICAL, LIFESTYLE_OPPOSITE)).toBe(25);
    });
  });

  describe('scoreExactOrOk - smoker, indoorEating', () => {
    it('smoker: 동일하면 12.5점', () => {
      const a = makeLifestyle({ smoker: 'YES' });
      const b = makeLifestyle({ smoker: 'YES' });
      const base = calcMatchScore(LIFESTYLE_IDENTICAL, LIFESTYLE_IDENTICAL); // 100
      const diff = base - calcMatchScore(a, b);
      expect(diff).toBe(0); // 동일이니 감점 없음
    });

    it('smoker: 다르면 12.5점 감점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ smoker: 'NO' });
      const b = makeLifestyle({ smoker: 'YES' });
      expect(calcMatchScore(a, b)).toBe(88);
    });

    it('indoorEating: OK vs NO -> OK가 있으므로 감점 없음', () => {
      const a = makeLifestyle({ indoorEating: 'OK' });
      const b = makeLifestyle({ indoorEating: 'NO' });
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('indoorEating: NO vs VENTILATE -> 둘 다 OK 아니면 감점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ indoorEating: 'NO' });
      const b = makeLifestyle({ indoorEating: 'VENTILATE' });
      expect(calcMatchScore(a, b)).toBe(88);
    });

    it('smoker: null이면 관대 처리 (12.5점)', () => {
      const a = makeLifestyle({ smoker: null });
      const b = makeLifestyle({ smoker: 'YES' });
      expect(calcMatchScore(a, b)).toBe(100);
    });
  });

  describe('scoreExact - sleepHabit, relationshipStyle', () => {
    it('sleepHabit: 동일하면 감점 없음', () => {
      const a = makeLifestyle({ sleepHabit: 'TALKING' });
      const b = makeLifestyle({ sleepHabit: 'TALKING' });
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('sleepHabit: 다르면 12.5점 감점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ sleepHabit: 'NONE' });
      const b = makeLifestyle({ sleepHabit: 'SNORING' });
      expect(calcMatchScore(a, b)).toBe(88);
    });

    it('relationshipStyle: 다르면 12.5점 감점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ relationshipStyle: 'CLOSE' });
      const b = makeLifestyle({ relationshipStyle: 'CASUAL' });
      expect(calcMatchScore(a, b)).toBe(88);
    });
  });

  describe('scoreOrdered - bedtime, wakeTime, noiseSensitivity, cleanliness', () => {
    it('bedtime: 동일하면 12.5점', () => {
      const a = makeLifestyle({ bedtime: '24_02' });
      const b = makeLifestyle({ bedtime: '24_02' });
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('bedtime: 인접(dist=1)이면 반점 (반올림 -> 94)', () => {
      const a = makeLifestyle({ bedtime: '22_24' });
      const b = makeLifestyle({ bedtime: '24_02' });
      expect(calcMatchScore(a, b)).toBe(94);
    });

    it('bedtime: 2칸 이상이면 0점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ bedtime: 'BEFORE_22' });
      const b = makeLifestyle({ bedtime: '24_02' });
      expect(calcMatchScore(a, b)).toBe(88);
    });

    it('wakeTime: 양 끝(dist=3)이면 0점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ wakeTime: 'BEFORE_06' });
      const b = makeLifestyle({ wakeTime: 'AFTER_10' });
      expect(calcMatchScore(a, b)).toBe(88);
    });

    it('noiseSensitivity: 인접이면 반점 (반올림 -> 94)', () => {
      const a = makeLifestyle({ noiseSensitivity: 'LOW' });
      const b = makeLifestyle({ noiseSensitivity: 'MID' });
      expect(calcMatchScore(a, b)).toBe(94);
    });

    it('cleanliness: 양 끝(dist=2)이면 0점 (반올림 -> 88)', () => {
      const a = makeLifestyle({ cleanliness: 'LOW' });
      const b = makeLifestyle({ cleanliness: 'HIGH' });
      expect(calcMatchScore(a, b)).toBe(88);
    });
  });

  describe('fixture 프로필 조합', () => {
    // 조용한하루(id:1) vs 겜돌이(id:2) 수동 계산:
    // smoker: NO vs NO -> 12.5
    // sleepHabit: NONE vs TALKING -> 0
    // indoorEating: OK vs VENTILATE -> OK 있음 -> 12.5
    // bedtime: 22_24 vs 24_02 -> dist=1 -> 6.25
    // wakeTime: 06_08 vs 08_10 -> dist=1 -> 6.25
    // noiseSensitivity: MID vs LOW -> dist=1 -> 6.25
    // cleanliness: HIGH vs MID -> dist=1 -> 6.25
    // relationshipStyle: CLOSE vs CASUAL -> 0
    // 합계: 50
    it('조용한하루 vs 겜돌이 -> 50점', () => {
      const profile1 = mockRawProfiles.find((p) => p.id === '1')!;
      const profile2 = mockRawProfiles.find((p) => p.id === '2')!;
      expect(calcMatchScore(profile1.lifestyle, profile2.lifestyle)).toBe(50);
    });

    // 조용한하루(id:1) vs 도서관지기(id:7) 수동 계산:
    // smoker: NO vs NO -> 12.5
    // sleepHabit: NONE vs NONE -> 12.5
    // indoorEating: OK vs NO -> OK 있음 -> 12.5
    // bedtime: 22_24 vs 22_24 -> dist=0 -> 12.5
    // wakeTime: 06_08 vs 06_08 -> dist=0 -> 12.5
    // noiseSensitivity: MID vs MID -> dist=0 -> 12.5
    // cleanliness: HIGH vs HIGH -> dist=0 -> 12.5
    // relationshipStyle: CLOSE vs CASUAL -> 0
    // 합계: 87.5 -> Math.round -> 88
    it('조용한하루 vs 도서관지기 -> 88점', () => {
      const profile1 = mockRawProfiles.find((p) => p.id === '1')!;
      const profile7 = mockRawProfiles.find((p) => p.id === '7')!;
      expect(calcMatchScore(profile1.lifestyle, profile7.lifestyle)).toBe(88);
    });

    it('자기 자신과 비교 -> 100점', () => {
      const profile1 = mockRawProfiles.find((p) => p.id === '1')!;
      expect(calcMatchScore(profile1.lifestyle, profile1.lifestyle)).toBe(100);
    });
  });
});
