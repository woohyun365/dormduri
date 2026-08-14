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

  it('신규 비밀번호 입력은 password manager와 입력 보조에 맞는 속성을 제공한다', () => {
    render(
      <InputField
        label="새 비밀번호"
        type="password"
        autoComplete="new-password"
        value=""
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('새 비밀번호');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('password field가 step 전환으로 다시 mount되면 표시 상태를 숨김으로 초기화한다', () => {
    const { rerender } = render(
      <InputField
        key="credentials"
        label="비밀번호"
        type="password"
        value="secret"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 보기' }));
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'text');

    rerender(
      <InputField
        key="next-step"
        label="비밀번호"
        type="password"
        value="secret"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: '비밀번호 보기' })).toBeInTheDocument();
  });

  it('읽기 상태의 긴 값은 consumer가 전달한 ellipsis layout을 적용한다', () => {
    render(
      <InputField
        label="학교 이메일"
        type="email"
        value="knuStudent@kangwon.ac.kr"
        onChange={vi.fn()}
        disabled
        inputClassName="truncate pr-28"
      />,
    );

    expect(screen.getByLabelText('학교 이메일')).toHaveClass('truncate', 'pr-28');
  });
});
