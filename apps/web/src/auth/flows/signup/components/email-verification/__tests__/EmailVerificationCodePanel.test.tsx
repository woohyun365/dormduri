import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailVerificationCodePanel } from '../EmailVerificationCodePanel';

const BASE_PROPS = {
  verificationCode: '',
  codeError: '',
  isAttemptsExhausted: false,
  isVerifying: false,
  isSending: false,
  isCountdownActive: true,
  emailRetryAfterSeconds: 0,
  codeRetryAfterSeconds: 0,
  countdown: 593,
  onCodeChange: vi.fn(),
  onVerifyCode: vi.fn(),
  onResendCode: vi.fn(),
  onChangeEmail: vi.fn(),
};

describe('EmailVerificationCodePanel', () => {
  it('인증 코드 유효시간 동안 버튼 내부 countdown과 함께 재전송을 막는다', () => {
    render(<EmailVerificationCodePanel {...BASE_PROPS} />);

    expect(screen.getByRole('button', { name: '재전송 · 9:53' })).toBeDisabled();
  });

  it('60초 미만은 분 단위 없이 초만 버튼에 표시한다', () => {
    render(<EmailVerificationCodePanel {...BASE_PROPS} countdown={57} />);

    expect(screen.getByRole('button', { name: '재전송 · 57초' })).toBeDisabled();
  });

  it('인증 코드가 만료되면 재전송을 허용한다', () => {
    render(<EmailVerificationCodePanel {...BASE_PROPS} isCountdownActive={false} countdown={0} />);

    expect(screen.getByRole('button', { name: '재전송' })).toBeEnabled();
  });

  it('메일 도움말을 상시 노출하고 이메일 수정 action을 제공한다', () => {
    const onChangeEmail = vi.fn();
    render(<EmailVerificationCodePanel {...BASE_PROPS} onChangeEmail={onChangeEmail} />);

    expect(screen.getByText('인증 메일이 보이지 않나요?')).toBeVisible();
    expect(screen.getByText('스팸함에도 없다면 이메일 주소를 확인해 주세요.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '이메일 다시 입력' }));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });
});
