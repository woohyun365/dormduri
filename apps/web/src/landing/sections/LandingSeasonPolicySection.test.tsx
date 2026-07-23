import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { landingSeasonJourneyItems } from '../content/landing-copy';
import { LandingSeasonPolicySection } from './LandingSeasonPolicySection';

describe('LandingSeasonPolicySection', () => {
  it('시즌 순서와 각 기간의 이용 범위를 함께 안내한다', () => {
    render(<LandingSeasonPolicySection />);

    expect(screen.getByRole('heading', { name: '시즌에 따라 달라요' })).toBeInTheDocument();

    const journey = screen.getByRole('list', { name: '한 학기 이용 흐름 예시' });
    expect(within(journey).getAllByRole('listitem')).toHaveLength(landingSeasonJourneyItems.length);
    expect(screen.getByText('가상 일정 예시')).toBeInTheDocument();
    expect(
      screen.getByText('실제 일정과 매칭 종료일은 학기·기숙사마다 달라요'),
    ).toBeInTheDocument();

    landingSeasonJourneyItems.forEach((item) => {
      expect(journey).toHaveTextContent(item.journeyLabel);
      expect(journey).toHaveTextContent(item.journeyDateLabel);
      expect(journey).toHaveTextContent(item.label);
      expect(journey).toHaveTextContent(item.journeyDescription);
    });

    expect(
      screen.queryByRole('region', { name: '매칭은 이렇게 진행해요' }),
    ).not.toBeInTheDocument();
  });
});
