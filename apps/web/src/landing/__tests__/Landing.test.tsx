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

vi.mock('../sections/LandingTrustBoundarySection', () => ({
  LandingTrustBoundarySection: () => <section data-testid="trust-boundary">TrustBoundary</section>,
}));

vi.mock('../sections/LandingHowItWorksSection', () => ({
  LandingHowItWorksSection: () => <section data-testid="how-it-works">HowItWorks</section>,
}));

vi.mock('../sections/LandingFeatureSection', () => ({
  LandingFeatureSection: () => <section data-testid="features">Features</section>,
}));

vi.mock('../sections/LandingSeasonPolicySection', () => ({
  LandingSeasonPolicySection: () => <section data-testid="season-policy">SeasonPolicy</section>,
}));

vi.mock('../sections/LandingSafetySupportSection', () => ({
  LandingSafetySupportSection: () => <section data-testid="safety-support">SafetySupport</section>,
}));

vi.mock('../sections/LandingFaqSection', () => ({
  LandingFaqSection: () => <section data-testid="faq">FAQ</section>,
}));

vi.mock('../sections/LandingFinalCtaSection', () => ({
  LandingFinalCtaSection: () => <section data-testid="final-cta">FinalCTA</section>,
}));

describe('Landing', () => {
  it('제품 서사 섹션이 올바른 순서로 렌더링된다', () => {
    render(<Landing />);

    const sections = [
      'landing-header',
      'hero',
      'trust-boundary',
      'how-it-works',
      'features',
      'season-policy',
      'safety-support',
      'faq',
      'final-cta',
      'landing-footer',
    ];

    sections.forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });

    const root = screen.getByTestId('landing-header').parentElement!;
    const main = root.querySelector('main')!;
    const orderAnchors = [
      screen.getByTestId('landing-header'),
      ...Array.from(main.children),
      screen.getByTestId('landing-footer'),
    ];
    const order = sections.map((id) => orderAnchors.indexOf(screen.getByTestId(id)));

    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    }
  });

  it('Header와 Footer가 각각 첫 번째와 마지막에 위치하고 본문은 main landmark 안에 있다', () => {
    render(<Landing />);

    const container = screen.getByTestId('landing-header').parentElement!;
    expect(container.firstElementChild).toBe(screen.getByTestId('landing-header'));
    expect(container.lastElementChild).toBe(screen.getByTestId('landing-footer'));
    expect(container.querySelector('main')).toBeInTheDocument();
  });
});
