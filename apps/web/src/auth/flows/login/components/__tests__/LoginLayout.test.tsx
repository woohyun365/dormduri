import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginLayout } from '../LoginLayout';

vi.mock('next/image', () => ({
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('LoginLayout', () => {
  it('로그인 shell, children, footer를 렌더링한다', () => {
    render(
      <LoginLayout footer={<a href="/privacy">개인정보처리방침</a>}>
        <h1 id="login-title">로그인</h1>
        <button type="button">로그인 폼 자리</button>
      </LoginLayout>,
    );

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인 폼 자리' })).toBeInTheDocument();
    expect(screen.getByText('강원대학교 비공식 독립 운영 서비스예요.').closest('p')).toHaveClass(
      '-mt-6',
      'mb-2',
      'whitespace-nowrap',
      'md:hidden',
    );
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    const headerContainer = screen.getByRole('banner').firstElementChild;
    expect(headerContainer).toHaveClass('max-w-5xl', 'lg:px-8');
  });

  it('desktop 좌측에 시즌, 룸메이트 요약, 이용 흐름 preview를 제공한다', () => {
    render(
      <LoginLayout>
        <h1 id="login-title">로그인</h1>
      </LoginLayout>,
    );

    expect(screen.getByText('서비스 이용 흐름')).toBeInTheDocument();
    expect(screen.getByText('시즌부터 매칭까지')).toBeInTheDocument();
    expect(screen.getByText('로그인 전, 간단히 이용 흐름을 확인해요.')).toBeInTheDocument();
    expect(screen.getByText('시즌을 눌러 이용 흐름을 확인해 보세요')).toBeInTheDocument();
    expect(screen.getByTestId('login-help-panel')).toHaveAttribute(
      'aria-labelledby',
      'login-preview-title',
    );
    expect(screen.getByTestId('login-help-panel')).toHaveClass(
      'hidden',
      'lg:block',
      'lg:[@media(min-height:700px)]:sticky',
      'lg:[@media(min-height:700px)]:top-32',
    );
    expect(screen.getByTestId('login-help-panel')).not.toHaveClass('lg:col-start-2');
    expect(screen.getByLabelText('시즌 이용 상태 예시')).toHaveTextContent('시즌 매칭');
    expect(screen.getByLabelText('서비스 시즌 흐름')).toHaveTextContent(
      '비시즌지난 기록시즌 오픈시즌 등록시즌 매칭후보·요청포스트 매치결과 확인',
    );
    expect(screen.getByLabelText('시즌 이용 상태 예시')).toHaveTextContent(
      '후보와 대화하고 매칭을 요청해요.',
    );
    expect(screen.queryByText('룸메이트 요약 예시')).not.toBeInTheDocument();
    expect(screen.getByLabelText('시즌 매칭 이용 흐름')).toHaveTextContent(
      '시즌 확인시즌 등록후보·대화요청·수락',
    );

    const loginContent = screen.getByRole('heading', { name: '로그인' }).closest('section');
    expect(loginContent).not.toHaveClass('lg:col-start-1', 'lg:row-start-1');
  });
});
