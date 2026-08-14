import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { landingMatchingCapabilitySteps } from '../content/landing-copy';
import { LandingFeatureSection } from './LandingFeatureSection';

describe('LandingFeatureSection', () => {
  it('핵심 기능을 매칭 흐름과 생활패턴 안내로 제공한다', () => {
    render(<LandingFeatureSection />);

    expect(screen.getByRole('heading', { name: '주요 기능' })).toBeInTheDocument();

    const matchingFlow = screen.getByRole('region', { name: '매칭은 이렇게 진행해요' });
    const featureList = within(matchingFlow).getByRole('list', {
      name: '핵심 매칭 기능 흐름',
    });
    const items = within(featureList).getAllByRole('listitem');
    expect(items).toHaveLength(landingMatchingCapabilitySteps.length);

    landingMatchingCapabilitySteps.forEach((step, index) => {
      expect(within(items[index]!).getByRole('heading', { name: step.title })).toBeInTheDocument();
      expect(items[index]).toHaveTextContent(step.description);
      expect(items[index]).toHaveTextContent(step.availabilityLabel);
    });

    expect(screen.getByRole('complementary', { name: '생활패턴 정보 안내' })).toHaveTextContent(
      '생활패턴 정보는 서로를 알아가기 위한 참고 자료예요.',
    );
  });
});
