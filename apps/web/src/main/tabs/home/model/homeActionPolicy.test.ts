import { describe, expect, it } from 'vitest';
import { buildHomeQuickActions } from './homeActionPolicy';

describe('homeActionPolicy', () => {
  it('keeps open season actions as navigation CTAs without HomeTab-level blocking', () => {
    const actions = buildHomeQuickActions({ seasonState: 'SEASON_OPEN' });

    expect(actions.map((action) => action.label)).toEqual([
      '룸메 찾기',
      '이전 기록',
      '채팅',
      '시즌 프로필',
    ]);
    expect(actions.map((action) => action.description)).toEqual([
      '후보 목록 확인',
      '지난 활동 확인',
      '대화 목록 확인',
      '기숙사·조건 설정',
    ]);
    expect(actions[2]).not.toHaveProperty('disabled');
  });

  it('keeps matching season actions focused on search, current matching, chat, and profile', () => {
    expect(
      buildHomeQuickActions({ seasonState: 'SEASON_MATCHING' }).map((action) => action.label),
    ).toEqual(['룸메 찾기', '매칭 현황', '채팅', '내 프로필']);
  });

  it('keeps off-season actions read-only and closes roommate search when capability is closed', () => {
    const actions = buildHomeQuickActions({ seasonState: 'OFF_SEASON' });

    expect(actions.map((action) => action.label)).toEqual(['이전 기록', '내 정보']);
    expect(actions.some((action) => action.target === 'list')).toBe(false);
    expect(actions.some((action) => action.target === 'chat')).toBe(false);
  });

  it('does not expose roommate search when there is no current season', () => {
    const actions = buildHomeQuickActions({
      seasonState: 'OFF_SEASON',
      hasCurrentSeason: false,
    });

    expect(actions.map((action) => action.label)).toEqual(['이전 기록', '내 정보']);
    expect(actions.some((action) => action.target === 'list')).toBe(false);
  });

  it('keeps off-season history CTA enabled even when no history exists yet', () => {
    const actions = buildHomeQuickActions({
      seasonState: 'OFF_SEASON',
      hasCurrentSeason: false,
      canViewMatchHistory: false,
    });

    expect(actions[0]).toMatchObject({
      label: '이전 기록',
      target: 'matching-history',
    });
  });

  it('does not expose new roommate search as a post-match primary action', () => {
    const actions = buildHomeQuickActions({
      seasonState: 'SEASON_POST_MATCH',
      canStartChat: false,
    });

    expect(actions.map((action) => action.label)).toEqual([
      '시즌 결과',
      '이전 기록',
      '과거 대화',
      '내 프로필',
    ]);
    expect(actions.some((action) => action.label === '룸메 찾기')).toBe(false);
    expect(actions.find((action) => action.label === '과거 대화')).toMatchObject({
      target: 'chat',
    });
    expect(actions.find((action) => action.label === '과거 대화')).not.toHaveProperty('disabled');
  });

  it('keeps post-match chat available when the dashboard capability allows it', () => {
    const actions = buildHomeQuickActions({ seasonState: 'SEASON_POST_MATCH', canStartChat: true });

    expect(actions.find((action) => action.target === 'chat')).toMatchObject({
      label: '채팅',
    });
  });
});
