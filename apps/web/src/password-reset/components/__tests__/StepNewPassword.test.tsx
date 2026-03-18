import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepNewPassword } from '../StepNewPassword';
import { authApi } from '@/api/auth';

vi.mock('lucide-react', () => ({
  Lock: () => null,
  AlertCircle: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    resetPassword: vi.fn(),
  },
}));

const mockResetPassword = vi.mocked(authApi.resetPassword);

describe('StepNewPassword', () => {
  const email = 'test@kangwon.ac.kr';
  let onResetComplete: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onResetComplete = vi.fn<() => void>();
    mockResetPassword.mockResolvedValue({ success: true });
  });

  it('유효하지 않은 비밀번호로 제출 시 에러를 표시하고 API를 호출하지 않는다', async () => {
    render(<StepNewPassword email={email} onResetComplete={onResetComplete} />);

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(onResetComplete).not.toHaveBeenCalled();
  });

  it('비밀번호 불일치 시 확인 에러를 표시한다', async () => {
    render(<StepNewPassword email={email} onResetComplete={onResetComplete} />);

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test1234' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test5678' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('유효한 비밀번호로 제출 성공 시 onResetComplete가 호출된다', async () => {
    render(<StepNewPassword email={email} onResetComplete={onResetComplete} />);

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test1234' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test1234' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(mockResetPassword).toHaveBeenCalledWith(email, 'Test1234');
    expect(onResetComplete).toHaveBeenCalled();
  });

  it('서버 오류 시 에러 메시지를 표시한다', async () => {
    mockResetPassword.mockResolvedValue({
      success: false,
      error: '이전과 동일한 비밀번호는 사용할 수 없습니다.',
    });

    render(<StepNewPassword email={email} onResetComplete={onResetComplete} />);

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test1234' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test1234' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(screen.getByText('이전과 동일한 비밀번호는 사용할 수 없습니다.')).toBeInTheDocument();
    expect(onResetComplete).not.toHaveBeenCalled();
  });

  it('비밀번호 입력 시 PasswordRequirementList가 표시된다', () => {
    render(<StepNewPassword email={email} onResetComplete={onResetComplete} />);

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'ab' } });

    expect(screen.getByText(/8자 이상/)).toBeInTheDocument();
  });
});
