import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { landingHowItWorksCopy, landingHowItWorksSteps } from '../content/landing-copy';
import { LandingHowItWorksSection } from './LandingHowItWorksSection';

describe('LandingHowItWorksSection', () => {
  it('이용 단계를 순서 목록과 공통 시즌 안내로 제공한다', () => {
    render(<LandingHowItWorksSection />);

    expect(screen.getByRole('heading', { name: landingHowItWorksCopy.title })).toBeInTheDocument();

    const process = screen.getByRole('list');
    const steps = within(process).getAllByRole('listitem');

    expect(steps).toHaveLength(landingHowItWorksSteps.length);
    landingHowItWorksSteps.forEach((step, index) => {
      expect(within(steps[index]!).getByRole('heading', { name: step.title })).toBeInTheDocument();
    });

    const scheduleNotice = screen.getByRole('complementary', {
      name: '학기별 매칭 일정 안내',
    });
    expect(scheduleNotice).toHaveTextContent(landingHowItWorksCopy.notice.title);
    expect(scheduleNotice).toHaveTextContent(landingHowItWorksCopy.notice.description);
    expect(within(scheduleNotice).queryByRole('link')).not.toBeInTheDocument();
  });
});
