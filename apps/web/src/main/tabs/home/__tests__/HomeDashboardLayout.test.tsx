import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeDashboardLayout } from '../HomeDashboardLayout';

describe('HomeDashboardLayout', () => {
  it('모바일 단일 컬럼 identity와 desktop dashboard grid owner class를 가진다', () => {
    render(
      <HomeDashboardLayout
        primary={<section>primary slot</section>}
        activity={<section>activity slot</section>}
        stats={<section>stats slot</section>}
        quickActions={<section>quick action slot</section>}
        tip={<section>tip slot</section>}
      />,
    );

    const layout = screen.getByTestId('home-dashboard-layout');
    expect(layout).toHaveClass('max-w-md');
    expect(layout).toHaveClass('md:max-w-5xl');
    expect(layout.firstElementChild).toHaveClass(
      'md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]',
    );
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('primary slot');
    expect(screen.getByLabelText('홈 보조 정보')).toHaveTextContent('stats slot');
  });
});
