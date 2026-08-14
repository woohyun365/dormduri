import { useState } from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PasswordResetActionResult } from '../../model/password-reset-flow.types';
import { PasswordResetNewPasswordStep } from '../PasswordResetNewPasswordStep';

vi.mock('lucide-react', () => ({
  Lock: () => null,
  CheckCircle2: () => null,
  Circle: () => null,
  CircleCheck: () => null,
  CircleX: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

describe('PasswordResetNewPasswordStep', () => {
  const email = 'test@kangwon.ac.kr';
  let onResetPassword: ReturnType<typeof vi.fn<() => Promise<PasswordResetActionResult>>>;

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
          isRateLimited={false}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onResetPassword={onResetPassword}
        />
      );
    }

    return render(<Harness />);
  }

  function getConfirmationRequirement() {
    const requirement = within(screen.getByRole('list', { name: '비밀번호 조건' }))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('비밀번호 확인 일치'));

    expect(requirement).toBeDefined();
    return requirement!;
  }

  beforeEach(() => {
    onResetPassword = vi.fn<() => Promise<PasswordResetActionResult>>();
    onResetPassword.mockResolvedValue({ success: true });
  });

  it('유효하지 않은 비밀번호로 제출 시 에러를 표시하고 submit action을 호출하지 않는다', async () => {
    renderStep();

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '새 비밀번호 저장' }));
    });

    expect(onResetPassword).not.toHaveBeenCalled();
  });

  it('비밀번호 불일치 시 확인 에러를 표시한다', async () => {
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test123456' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test5678' } });

    expect(getConfirmationRequirement()).toHaveTextContent('확인 필요');

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '새 비밀번호 저장' }));
    });

    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    expect(onResetPassword).not.toHaveBeenCalled();
  });

  it('유효한 비밀번호로 제출 성공 시 submit action이 호출된다', async () => {
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test123456' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test123456' } });

    expect(getConfirmationRequirement()).toHaveTextContent('충족');

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '새 비밀번호 저장' }));
    });

    expect(onResetPassword).toHaveBeenCalledTimes(1);
  });

  it('submit action의 non-field 오류는 step 내부에서 중복 렌더링하지 않는다', async () => {
    onResetPassword.mockResolvedValue({
      success: false,
      error: '이전과 동일한 비밀번호는 사용할 수 없습니다.',
    });

    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Test123456' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Test123456' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '새 비밀번호 저장' }));
    });

    expect(
      screen.queryByText('이전과 동일한 비밀번호는 사용할 수 없습니다.'),
    ).not.toBeInTheDocument();
    expect(onResetPassword).toHaveBeenCalledTimes(1);
  });

  it('API-private 비밀번호 정책 거절은 입력을 유지하고 generic field feedback을 표시한다', async () => {
    onResetPassword.mockResolvedValue({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
      fieldErrors: {
        newPassword: '다른 비밀번호를 입력해 주세요.',
      },
    });
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'Password1!' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Password1!' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: '새 비밀번호 저장' }));
    });

    expect(inputs[0]).toHaveValue('Password1!');
    expect(screen.getByText('다른 비밀번호를 입력해 주세요.')).toBeInTheDocument();
    expect(inputs[0]).toHaveFocus();
  });

  it('비밀번호 입력 시 PasswordRequirementList가 표시된다', () => {
    renderStep();

    const inputs = screen.getAllByLabelText(/비밀번호/);
    fireEvent.change(inputs[0]!, { target: { value: 'ab' } });

    expect(screen.getByText(/10~128자/)).toBeInTheDocument();
  });
});
