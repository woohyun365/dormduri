'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { DevOnly } from '@/components/DevOnly';
import { useCountdown } from '@/hooks/useCountdown';
import { validateKnuEmail } from '@/utils/validation';
import { VERIFICATION_CODE_TTL, TEST_VERIFICATION_CODE } from '@/constants/auth';
import { Mail, CheckCircle } from 'lucide-react';

interface StepEmailVerificationProps {
  email: string;
  onEmailChange: (email: string) => void;
  isVerified: boolean;
  onVerified: () => void;
  onNext: () => void;
}

export function StepEmailVerification({
  email,
  onEmailChange,
  isVerified,
  onVerified,
  onNext,
}: StepEmailVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const {
    countdown,
    isActive,
    start: startCountdown,
    stop: stopCountdown,
    formatTime,
  } = useCountdown(VERIFICATION_CODE_TTL);

  const handleSendCode = () => {
    const error = validateKnuEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    setEmailError('');
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setIsCodeSent(true);
      startCountdown();
    }, 1000);
  };

  const handleVerifyCode = () => {
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      return;
    }
    if (verificationCode === TEST_VERIFICATION_CODE) {
      setCodeError('');
      onVerified();
      stopCountdown();
    } else {
      setCodeError('인증 코드가 올바르지 않습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<Mail className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="이메일 인증"
        description="강원대학교 이메일로 인증해주세요"
      />

      <div className="space-y-4">
        <div className="relative">
          <InputField
            label="학교 이메일"
            type="email"
            placeholder="example@kangwon.ac.kr"
            value={email}
            onChange={(value) => {
              onEmailChange(value);
              setEmailError('');
            }}
            error={emailError}
            disabled={isVerified}
          />
          {isVerified && (
            <div className="absolute right-4 top-11 flex items-center gap-1 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-semibold">인증완료</span>
            </div>
          )}
        </div>

        {!isCodeSent && !isVerified && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSendCode}
            disabled={isSending}
          >
            {isSending ? '전송 중...' : '인증 코드 전송'}
          </Button>
        )}

        {isCodeSent && !isVerified && (
          <>
            <div className="relative">
              <InputField
                label="인증 코드"
                type="text"
                placeholder="6자리 인증 코드"
                value={verificationCode}
                onChange={(value) => {
                  setVerificationCode(value);
                  setCodeError('');
                }}
                error={codeError}
                maxLength={6}
              />
              {isActive && (
                <div
                  className="absolute right-4 top-11 text-sm font-semibold text-red-500"
                  role="timer"
                  aria-live="polite"
                >
                  {formatTime()}
                </div>
              )}
            </div>

            <DevOnly>
              <p className="text-sm text-blue-900">
                <strong>테스트용 인증 코드:</strong> {TEST_VERIFICATION_CODE}
              </p>
            </DevOnly>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={handleSendCode}
                disabled={isSending || isActive}
              >
                재전송{isActive ? ` (${formatTime()})` : ''}
              </Button>
              <Button variant="primary" size="lg" fullWidth onClick={handleVerifyCode}>
                인증 확인
              </Button>
            </div>
          </>
        )}
      </div>

      {isVerified && (
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          다음 단계
        </Button>
      )}
    </div>
  );
}
