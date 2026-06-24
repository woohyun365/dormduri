import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasswordResetNewPasswordStep } from '../PasswordResetNewPasswordStep';

vi.mock('lucide-react', () => ({
  Lock: () => null,
  AlertCircle: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

describe('PasswordResetNewPasswordStep', () => {
  const email = 'test@kangwon.ac.kr';
  let onResetPassword: ReturnType<
    typeof vi.fn<() => Promise<{ success: boolean; error?: string }>>
  >;

  function renderStep() {
    function Harness() {
      const [newPassword, setNewPassword] = useState('');
      const [confirmPassword, setConfirmPassword] = useState('');

      return (
        <PasswordResetNewPasswordStep
          email={email}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          isResetting={false}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onResetPassword={onResetPassword}
        />
      );
    }

    return render(<Harness />);
  }

  beforeEach(() => {
    onResetPassword = vi.fn<() => Promise<{ success: boolean; error?: string }>>();
    onResetPassword.mockResolvedValue({ success: true });
  });

  it('유효하지 않은 비밀번호로 제출 시 에러를 표시하고 submit action을 호출하지 않는다', async () => {
    renderStep();

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(onResetPassword).not.toHaveBeenCalled();
  });

  it('비밀번호 불일치 시 확인 에러를 표시한다', async () => {
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test1234' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test5678' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    expect(onResetPassword).not.toHaveBeenCalled();
  });

  it('유효한 비밀번호로 제출 성공 시 submit action이 호출된다', async () => {
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test1234' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test1234' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(onResetPassword).toHaveBeenCalledTimes(1);
  });

  it('submit action 오류 시 에러 메시지를 표시한다', async () => {
    onResetPassword.mockResolvedValue({
      success: false,
      error: '이전과 동일한 비밀번호는 사용할 수 없습니다.',
    });

    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test1234' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test1234' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '비밀번호 재설정' }));
    });

    expect(screen.getByText('이전과 동일한 비밀번호는 사용할 수 없습니다.')).toBeInTheDocument();
  });

  it('비밀번호 입력 시 PasswordRequirementList가 표시된다', () => {
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'ab' } });

    expect(screen.getByText(/8자 이상/)).toBeInTheDocument();
  });
});
