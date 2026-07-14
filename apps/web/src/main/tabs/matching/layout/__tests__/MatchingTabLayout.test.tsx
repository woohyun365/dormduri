import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatchingTabHeader } from '../MatchingTabHeader';
import { MatchingTabLayout } from '../MatchingTabLayout';

describe('MatchingTabLayout', () => {
  it('Main의 page main 안에서 nested main 없이 단일 heading과 responsive grid를 제공한다', () => {
    const { container } = render(
      <main>
        <MatchingTabLayout header={<MatchingTabHeader />} rail={<p>도움말</p>}>
          <p>primary</p>
        </MatchingTabLayout>
      </main>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByTestId('matching-tab-layout')).toHaveClass(
      'max-w-[1152px]',
      'lg:grid-cols-[minmax(0,720px)_320px]',
      'lg:gap-6',
      'overflow-x-clip',
    );
  });

  it('supporting policy content를 mobile DOM 순서에서 primary 뒤에 유지한다', () => {
    render(
      <MatchingTabLayout header={<MatchingTabHeader />} rail={<p>도움말</p>}>
        <p>primary</p>
      </MatchingTabLayout>,
    );

    const primary = screen.getByTestId('matching-tab-primary');
    const rail = screen.getByTestId('matching-policy-rail');
    expect(primary.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rail).not.toHaveClass('hidden');
  });
});
