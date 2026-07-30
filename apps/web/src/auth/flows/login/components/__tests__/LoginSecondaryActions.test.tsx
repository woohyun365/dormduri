import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  LoginLegalFooter,
  LoginPasswordResetAction,
  LoginSignupAction,
} from '../LoginSecondaryActions';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="icon-mail" />,
}));

describe('LoginSecondaryActions', () => {
  it('비밀번호 찾기와 회원가입 action을 callback으로 분리한다', async () => {
    const onPasswordResetClick = vi.fn();
    const onSignupClick = vi.fn();

    const user = userEvent.setup();

    render(
      <>
        <LoginPasswordResetAction onClick={onPasswordResetClick} />
        <LoginSignupAction onClick={onSignupClick} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    await user.click(screen.getByRole('button', { name: '이메일로 회원가입' }));

    expect(onPasswordResetClick).toHaveBeenCalledTimes(1);
    expect(onSignupClick).toHaveBeenCalledTimes(1);
  });

  it('legal links는 terms/privacy 정적 링크를 제공한다', () => {
    render(<LoginLegalFooter />);

    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    const notice = screen.getByText(
      '본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.',
    );
    const legalNavigation = screen.getByRole('navigation', { name: '법적 안내' });
    const legalSection = legalNavigation.parentElement;
    const legalFooter = legalNavigation.closest('footer');
    const decorativeSeparator = legalNavigation.querySelector('[aria-hidden="true"]');

    expect(legalFooter).toBeInTheDocument();
    expect(legalFooter).toHaveClass('mt-8', 'md:mt-[27px]');
    expect(notice.closest('p')).toHaveClass('hidden', 'md:block');
    expect(legalNavigation).toHaveClass('inline-flex');
    expect(legalSection).toHaveClass('border-t');
    expect(decorativeSeparator).toHaveClass('h-3', 'w-px', 'bg-slate-300');
    expect(decorativeSeparator).toHaveTextContent('');
    expect(
      notice.compareDocumentPosition(legalNavigation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: '자세히 보기' })).not.toBeInTheDocument();
  });

  it('pending 상태에서는 비밀번호 찾기 action을 잠근다', async () => {
    const onPasswordResetClick = vi.fn();
    const user = userEvent.setup();

    render(<LoginPasswordResetAction onClick={onPasswordResetClick} disabled />);

    const action = screen.getByRole('button', { name: '비밀번호 찾기' });
    expect(action).toBeDisabled();
    await user.click(action);
    expect(onPasswordResetClick).not.toHaveBeenCalled();
  });
});
