import { describe, expect, it } from 'vitest';
import { buildHomeQuickActions } from './homeActionPolicy';

describe('homeActionPolicy', () => {
  it('keeps open season actions preview/readiness oriented until matching opens', () => {
    expect(
      buildHomeQuickActions({ seasonState: 'SEASON_OPEN' }).map((action) => action.label),
    ).toEqual(['룸메 찾기', '이전 기록', '채팅', '내 프로필']);
    expect(buildHomeQuickActions({ seasonState: 'SEASON_OPEN' })[2]).toMatchObject({
      description: '시즌 중 이용',
      disabled: true,
    });
  });

  it('keeps matching season actions focused on search, current matching, chat, and profile', () => {
    expect(
      buildHomeQuickActions({ seasonState: 'SEASON_MATCHING' }).map((action) => action.label),
    ).toEqual(['룸메 찾기', '매칭 현황', '채팅', '내 프로필']);
  });

  it('keeps off-season actions read-only and closes roommate search when capability is closed', () => {
    const actions = buildHomeQuickActions({ seasonState: 'OFF_SEASON' });

    expect(actions.map((action) => action.label)).toEqual([
      '탐색 닫힘',
      '이전 기록',
      '과거 대화',
      '내 프로필',
    ]);
    expect(actions.find((action) => action.label === '탐색 닫힘')).toMatchObject({
      disabled: true,
      target: 'list',
    });
    expect(actions.find((action) => action.label === '과거 대화')).toMatchObject({
      disabled: true,
    });
  });

  it('does not expose roommate search when there is no current season', () => {
    const actions = buildHomeQuickActions({
      seasonState: 'OFF_SEASON',
      hasCurrentSeason: false,
    });

    expect(actions.map((action) => action.label)).toEqual(['이전 기록', '내 프로필']);
    expect(actions.some((action) => action.target === 'list')).toBe(false);
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
      disabled: true,
      target: 'chat',
    });
  });

  it('keeps post-match chat available when the dashboard capability allows it', () => {
    const actions = buildHomeQuickActions({ seasonState: 'SEASON_POST_MATCH', canStartChat: true });

    expect(actions.find((action) => action.target === 'chat')).toMatchObject({
      label: '채팅',
      disabled: undefined,
    });
  });
});
