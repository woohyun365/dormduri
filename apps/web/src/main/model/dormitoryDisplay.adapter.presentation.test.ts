import { describe, expect, it } from 'vitest';
import { formatDormitoryDisplayLabel } from './dormitoryDisplay.adapter';

const dormitory = {
  id: 'dasan',
  name: '다산관',
  roomType: 2,
  genderPolicy: 'M',
} as const;

describe('formatDormitoryDisplayLabel', () => {
  it('선택한 기숙사 공개 정보로 표시 문구를 만든다', () => {
    expect(formatDormitoryDisplayLabel('dasan', dormitory)).toBe('다산관 2인실');
  });

  it('선택 id와 공개 정보가 일치하지 않으면 표시하지 않는다', () => {
    expect(formatDormitoryDisplayLabel('saerom', dormitory)).toBe('');
    expect(formatDormitoryDisplayLabel(null, dormitory)).toBe('');
  });
});
