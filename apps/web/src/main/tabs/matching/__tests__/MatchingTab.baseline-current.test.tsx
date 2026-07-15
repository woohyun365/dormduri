import { render, screen } from '@testing-library/react';
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
  const currentScenarios = Object.values(matchingTabStoryScenarios);

  it.each(currentScenarios)('$title fixture를 렌더링한다', (scenario) => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(MATCHING_BASELINE_NOW).getTime());

    render(<MatchingTabStorySurface scenario={scenario} />);

    expect(screen.getByTestId('matching-tab-story-surface')).toBeInTheDocument();
  });

  it('current fixture matrix에 출시되지 않은 group fixture를 넣지 않는다', () => {
    expect(matchingTabStoryScenarios).not.toHaveProperty('seasonMatchingGroupLegacy');
  });

  it('받은 요청 baseline은 story-local pair artifact로 렌더링한다', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(MATCHING_BASELINE_NOW).getTime());

    render(<MatchingTabStorySurface scenario={matchingTabStoryScenarios.seasonMatchingReceived} />);

    expect(screen.getByText('Baseline · Legacy · Pair only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수락하기' })).toBeInTheDocument();
  });
});
