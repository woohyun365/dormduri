import { hasNicknameCooldown } from './nickname-cooldown.policy.js';

const NOW = new Date('2026-05-31T00:00:00.000Z');

describe('hasNicknameCooldown', () => {
  it('nicknameChangedAt이 없으면 cooldown이 아니다', () => {
    expect(hasNicknameCooldown(null, NOW)).toBe(false);
  });

  it('30일 이내면 cooldown active로 판단한다', () => {
    expect(hasNicknameCooldown(new Date('2026-05-02T00:00:00.001Z'), NOW)).toBe(true);
  });

  it('30일 경계가 지나면 cooldown active가 아니다', () => {
    expect(hasNicknameCooldown(new Date('2026-05-01T00:00:00.000Z'), NOW)).toBe(false);
  });
});
