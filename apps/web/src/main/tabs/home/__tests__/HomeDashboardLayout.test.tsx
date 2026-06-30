import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeDashboardLayout } from '../HomeDashboardLayout';

describe('HomeDashboardLayout', () => {
  it('모바일 단일 컬럼 identity와 desktop dashboard grid owner class를 가진다', () => {
    render(
      <HomeDashboardLayout
        primary={<section>primary slot</section>}
        readiness={<section>readiness slot</section>}
        activity={<section>activity slot</section>}
        stats={<section>stats slot</section>}
        quickActions={<section>quick action slot</section>}
        tip={<section>tip slot</section>}
      />,
    );

    const layout = screen.getByTestId('home-dashboard-layout');
    expect(layout).toHaveClass('max-w-md');
    expect(layout).toHaveClass('md:max-w-5xl');
    expect(screen.getByTestId('home-dashboard-section-grid')).toHaveClass(
      'md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]',
    );
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('primary slot');
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('activity slot');
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('quick action slot');
    expect(screen.getByLabelText('홈 보조 정보')).toHaveTextContent('stats slot');
    expect(screen.getByLabelText('홈 보조 정보')).toHaveTextContent('readiness slot');
  });

  it('모바일 단일 컬럼 section order를 primary → readiness → activity → stats → quickActions → tip으로 고정한다', () => {
    render(
      <HomeDashboardLayout
        primary={<section>primary slot</section>}
        readiness={<section>readiness slot</section>}
        activity={<section>activity slot</section>}
        stats={<section>stats slot</section>}
        quickActions={<section>quick action slot</section>}
        tip={<section>tip slot</section>}
      />,
    );

    expect(screen.getByTestId('home-section-primary')).toHaveClass('order-1');
    expect(screen.getByTestId('home-section-readiness')).toHaveClass('order-2');
    expect(screen.getByTestId('home-section-activity')).toHaveClass('order-4');
    expect(screen.getByTestId('home-section-stats')).toHaveClass('order-5');
    expect(screen.getByTestId('home-section-quick-actions')).toHaveClass('order-6');
    expect(screen.getByTestId('home-section-tip')).toHaveClass('order-7');
  });
});
