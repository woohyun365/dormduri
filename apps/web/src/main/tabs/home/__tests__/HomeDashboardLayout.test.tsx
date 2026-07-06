import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeDashboardLayout } from '../layout/HomeDashboardLayout';

function renderLayout() {
  render(
    <HomeDashboardLayout
      notice={<section>notice slot</section>}
      primary={<section>primary slot</section>}
      readiness={<section>readiness slot</section>}
      activity={<section>activity slot</section>}
      assistance={<section>assistance slot</section>}
      quickActions={<section>quick action slot</section>}
    />,
  );
}

describe('HomeDashboardLayout', () => {
  it('모바일 단일 컬럼 identity와 desktop dashboard grid owner class를 가진다', () => {
    renderLayout();

    const layout = screen.getByTestId('home-dashboard-layout');
    expect(layout).toHaveClass('max-w-md');
    expect(layout).toHaveClass('md:max-w-5xl');
    expect(screen.getByTestId('home-dashboard-section-grid')).toHaveClass('space-y-5');
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('primary slot');
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('activity slot');
    expect(screen.getByLabelText('홈 주요 상태')).toHaveTextContent('quick action slot');
    expect(screen.getByLabelText('홈 보조 정보')).toHaveTextContent('readiness slot');
    expect(screen.getByLabelText('홈 보조 정보')).toHaveTextContent('assistance slot');
  });

  it('공지사항은 dashboard grid 위 full-width slot으로 분리한다', () => {
    renderLayout();

    expect(screen.getByTestId('home-section-notice')).toHaveTextContent('notice slot');
    expect(screen.getByTestId('home-section-notice')).toHaveClass('empty:hidden');
  });

  it('모바일 단일 컬럼 section order를 notice → primary → readiness → activity → quickActions → assistance로 고정한다', () => {
    renderLayout();

    expect(screen.getByTestId('home-section-primary')).toHaveClass('order-1');
    expect(screen.getByTestId('home-section-readiness')).toHaveClass('order-2');
    expect(screen.getByTestId('home-section-activity')).toHaveClass('order-4');
    expect(screen.getByTestId('home-section-quick-actions')).toHaveClass('order-5');
    expect(screen.getByTestId('home-section-assistance')).toHaveClass('order-6');
  });
});
