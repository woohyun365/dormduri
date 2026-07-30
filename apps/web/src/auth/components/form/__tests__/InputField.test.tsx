import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InputField } from '../InputField';

describe('InputField', () => {
  it('field 상태와 오류 메시지를 접근성 속성으로 연결한다', () => {
    render(
      <InputField
        label="이메일"
        type="email"
        value=""
        error="이메일을 확인해 주세요."
        onChange={vi.fn()}
        reserveMessageSpace
      />,
    );

    const input = screen.getByLabelText('이메일');
    const field = input.closest('[data-slot="field"]');
    const message = screen.getByRole('alert');

    expect(field).toHaveAttribute('data-invalid', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', message.id);
    expect(message.parentElement).toHaveClass('min-h-6');
  });

  it('disabled password field에서는 비밀번호 표시 action도 잠근다', () => {
    render(
      <InputField
        label="비밀번호"
        type="password"
        value="Password123!"
        onChange={vi.fn()}
        disabled
      />,
    );

    const input = screen.getByLabelText('비밀번호');
    const visibilityAction = screen.getByRole('button', { name: '비밀번호 보기' });

    expect(input).toHaveAttribute('type', 'password');
    expect(visibilityAction).toBeDisabled();

    fireEvent.click(visibilityAction);

    expect(input).toHaveAttribute('type', 'password');
  });
});
