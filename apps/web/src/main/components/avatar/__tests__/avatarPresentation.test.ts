import { describe, expect, it } from 'vitest';
import { getAvatarColor } from '../avatarPresentation';

describe('getAvatarColor', () => {
  it('같은 닉네임에는 항상 같은 색상을 반환한다', () => {
    expect(getAvatarColor('민재')).toEqual({ bg: 'bg-rose-100', text: 'text-rose-600' });
    expect(getAvatarColor('민재')).toEqual(getAvatarColor('민재'));
  });

  it('닉네임 hash에 따라 팔레트 색상을 선택한다', () => {
    expect(getAvatarColor('봄날')).toEqual({ bg: 'bg-cyan-100', text: 'text-cyan-600' });
  });
});
