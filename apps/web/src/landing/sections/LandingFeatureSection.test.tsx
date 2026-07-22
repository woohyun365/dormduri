import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { landingFeatureItems } from '../content/landing-copy';
import { LandingFeatureSection } from './LandingFeatureSection';

describe('LandingFeatureSection', () => {
  it('핵심 기능을 짧은 목록과 생활패턴 안내로 제공한다', () => {
    render(<LandingFeatureSection />);

    expect(screen.getByRole('heading', { name: '주요 기능' })).toBeInTheDocument();

    const featureList = screen.getByRole('list');
    const items = within(featureList).getAllByRole('listitem');
    expect(items).toHaveLength(landingFeatureItems.length);

    landingFeatureItems.forEach((item, index) => {
      expect(within(items[index]!).getByRole('heading', { name: item.title })).toBeInTheDocument();
    });

    expect(screen.getByRole('complementary', { name: '생활패턴 정보 안내' })).toHaveTextContent(
      '생활패턴 정보는 서로를 알아가기 위한 참고 자료예요.',
    );
  });
});
