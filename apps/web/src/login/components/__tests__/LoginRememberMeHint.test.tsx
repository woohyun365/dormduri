import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginRememberMeHint } from '../LoginRememberMeHint';

describe('LoginRememberMeHint', () => {
  it('visible=false이면 안내를 숨긴다', () => {
    const { container } = render(<LoginRememberMeHint visible={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('visible=true이면 7일 유지와 개인 기기 권장 안내를 표시한다', () => {
    render(<LoginRememberMeHint visible />);

    expect(screen.getByText(/개인 기기에서만 사용해주세요/)).toBeInTheDocument();
    expect(screen.getByText(/최대 7일 동안 다시 로그인하지 않아도 됩니다/)).toBeInTheDocument();
  });
});
