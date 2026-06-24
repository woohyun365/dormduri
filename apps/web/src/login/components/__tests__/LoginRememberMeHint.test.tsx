import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginRememberMeHint } from '../LoginRememberMeHint';

describe('LoginRememberMeHint', () => {
  it('visible=false이면 안내를 숨긴다', () => {
    const { container } = render(<LoginRememberMeHint visible={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('visible=true이면 기존 로그인 유지 안내를 표시한다', () => {
    render(<LoginRememberMeHint visible />);

    expect(screen.getByText('브라우저를 닫아도 로그인 상태가 유지됩니다')).toBeInTheDocument();
  });
});
