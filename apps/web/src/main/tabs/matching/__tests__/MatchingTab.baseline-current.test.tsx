import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchingTabStorySurface } from '../__stories__/matching-story-renderer';
import {
  MATCHING_BASELINE_NOW,
  matchingTabStoryScenarios,
} from '../__stories__/matching-story-scenarios';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MatchingTab current baseline stories', () => {
  const currentScenarios = Object.values(matchingTabStoryScenarios).filter(
    (scenario) => scenario.key !== 'season-matching-group-legacy',
  );

  it.each(currentScenarios)('$title fixture를 렌더링한다', (scenario) => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(MATCHING_BASELINE_NOW).getTime());

    render(<MatchingTabStorySurface scenario={scenario} />);

    expect(screen.getByTestId('matching-tab-story-surface')).toBeInTheDocument();
  });

  it('unsupported group fixture는 legacy comparison surface에서만 렌더링한다', () => {
    render(
      <MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingGroupLegacy} />,
    );

    expect(screen.getByTestId('matching-tab-story-surface')).toBeInTheDocument();
  });

  it('받은 요청의 더보기 메뉴를 연다', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(MATCHING_BASELINE_NOW).getTime());
    const ui = userEvent.setup();

    render(<MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingReceived} />);

    await ui.click(screen.getByRole('button', { name: '더보기' }));

    expect(screen.getByRole('button', { name: '프로필 보기' })).toBeInTheDocument();
  });

  it('받은 요청 수락 확인 dialog를 연다', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(MATCHING_BASELINE_NOW).getTime());
    const ui = userEvent.setup();

    render(<MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingReceived} />);

    await ui.click(screen.getByRole('button', { name: '수락하기' }));

    expect(screen.getByRole('alertdialog', { name: '요청 수락' })).toBeInTheDocument();
  });
});
