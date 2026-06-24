import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  LoginLegalLinks,
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
  it('비밀번호 찾기와 회원가입 action을 callback으로 분리한다', () => {
    const onPasswordResetClick = vi.fn();
    const onSignupClick = vi.fn();

    render(
      <>
        <LoginPasswordResetAction onClick={onPasswordResetClick} />
        <LoginSignupAction onClick={onSignupClick} />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: '이메일로 회원가입' }));

    expect(onPasswordResetClick).toHaveBeenCalledTimes(1);
    expect(onSignupClick).toHaveBeenCalledTimes(1);
  });

  it('legal links는 terms/privacy 정적 링크를 제공한다', () => {
    render(<LoginLegalLinks />);

    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
