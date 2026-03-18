import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Landing from '../Landing';

vi.mock('../components/LandingHeader', () => ({
  LandingHeader: () => <header data-testid="landing-header">Header</header>,
}));

vi.mock('../components/LandingFooter', () => ({
  LandingFooter: () => <footer data-testid="landing-footer">Footer</footer>,
}));

vi.mock('../sections/LandingHeroSection', () => ({
  LandingHeroSection: () => <section data-testid="hero">Hero</section>,
}));

vi.mock('../sections/LandingProblemSolutionSection', () => ({
  LandingProblemSolutionSection: () => (
    <section data-testid="problem-solution">ProblemSolution</section>
  ),
}));

vi.mock('../sections/LandingFeaturesSection', () => ({
  LandingFeaturesSection: () => <section data-testid="features">Features</section>,
}));

vi.mock('../sections/LandingSeasonPolicySection', () => ({
  LandingSeasonPolicySection: () => <section data-testid="season-policy">SeasonPolicy</section>,
}));

vi.mock('../sections/LandingFaqSection', () => ({
  LandingFaqSection: () => <section data-testid="faq">FAQ</section>,
}));

vi.mock('../sections/LandingCtaSection', () => ({
  LandingCtaSection: () => <section data-testid="cta">CTA</section>,
}));

describe('Landing', () => {
  it('모든 핵심 섹션이 올바른 순서로 렌더링된다', () => {
    render(<Landing />);

    const sections = [
      'landing-header',
      'hero',
      'problem-solution',
      'features',
      'season-policy',
      'faq',
      'cta',
      'landing-footer',
    ];

    sections.forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });

    const container = screen.getByTestId('landing-header').parentElement!;
    const children = Array.from(container.children);
    const order = sections.map((id) => children.indexOf(screen.getByTestId(id)));

    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    }
  });

  it('Header와 Footer가 각각 첫 번째와 마지막에 위치한다', () => {
    render(<Landing />);

    const container = screen.getByTestId('landing-header').parentElement!;
    expect(container.firstElementChild).toBe(screen.getByTestId('landing-header'));
    expect(container.lastElementChild).toBe(screen.getByTestId('landing-footer'));
  });
});
