import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MatchingSectionTabs, type MatchingSection } from '../MatchingSectionTabs';

function Harness() {
  const [selected, setSelected] = useState<MatchingSection>('current');
  return <MatchingSectionTabs selected={selected} onSelect={setSelected} />;
}

describe('MatchingSectionTabs', () => {
  it('Arrow/Home/End는 focus만 옮기고 Enter/Space/click만 manual selection을 변경한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const current = screen.getByRole('tab', { name: '현재 매칭' });
    const past = screen.getByRole('tab', { name: '지난 기록' });

    expect(current).toHaveAttribute('aria-selected', 'true');
    expect(current).toHaveAttribute('aria-controls', 'matching-section-panel-current');
    expect(past).toHaveAttribute('aria-selected', 'false');
    expect(past).toHaveAttribute('tabindex', '-1');

    current.focus();
    await user.keyboard('{ArrowRight}');
    expect(past).toHaveFocus();
    expect(current).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(past).toHaveFocus();
    await user.keyboard('{Home}');
    expect(current).toHaveFocus();

    await user.keyboard('{ArrowRight}{Enter}');
    expect(past).toHaveAttribute('aria-selected', 'true');
    expect(past).toHaveAttribute('tabindex', '0');
    expect(current).toHaveAttribute('tabindex', '-1');
  });
});
