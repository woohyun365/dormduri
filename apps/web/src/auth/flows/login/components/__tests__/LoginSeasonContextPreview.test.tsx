import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LoginSeasonContextPreview } from '../preview/LoginSeasonContextPreview';

describe('LoginSeasonContextPreview', () => {
  it('시즌 매칭을 기본 선택하고 선택한 시즌의 이용 기능을 안내한다', () => {
    render(<LoginSeasonContextPreview />);

    expect(screen.getByRole('tab', { name: /시즌 매칭/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('selected-season-label')).toHaveTextContent('시즌 매칭');
    expect(screen.getByText('시즌을 눌러 이용 흐름을 확인해 보세요')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('후보와 대화하고 매칭을 요청해요.');
    expect(screen.getByLabelText('시즌 매칭 이용 흐름')).toHaveTextContent(
      '시즌 확인시즌 등록후보·대화요청·수락',
    );
    expect(screen.getByLabelText('시즌 매칭 이용 흐름')).not.toHaveTextContent('매칭 후 대화');
  });

  it('터치·클릭으로 시즌을 선택해 detail을 전환한다', async () => {
    const user = userEvent.setup();
    render(<LoginSeasonContextPreview />);

    await user.click(screen.getByRole('tab', { name: /비시즌/ }));

    expect(screen.getByRole('tab', { name: /비시즌/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      '참여했었던 시즌의 매칭 결과를 확인해요.',
    );
    expect(screen.getByTestId('selected-season-label')).toHaveTextContent('비시즌');
    expect(screen.getByText('시즌을 눌러 이용 흐름을 확인해 보세요')).toBeInTheDocument();
    expect(screen.getByLabelText('비시즌 이용 흐름')).toHaveTextContent('시즌 확인과거 이력 확인');
  });

  it('방향키와 Home·End 키로 시즌을 탐색한다', async () => {
    const user = userEvent.setup();
    render(<LoginSeasonContextPreview />);

    const matchingTab = screen.getByRole('tab', { name: /시즌 매칭/ });
    matchingTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /포스트 매치/ })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('이번 시즌 결과와 활동을 확인해요.');
    expect(screen.getByText('시즌을 눌러 이용 흐름을 확인해 보세요')).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /비시즌/ })).toHaveFocus();
  });
});
