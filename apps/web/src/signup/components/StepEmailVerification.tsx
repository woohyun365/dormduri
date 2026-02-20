'use client';

import { useState, useEffect, useRef } from 'react';
import { InputField } from './InputField';
import { LandingButton } from '@/landing/components/landing/LandingButton';
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
  const [countdown, setCountdown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const validateEmail = (value: string) => {
    if (!value) return '이메일을 입력해주세요.';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@kangwon\.ac\.kr$/;
    if (!emailRegex.test(value)) {
      return '올바른 강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.';
    }
    return '';
  };

  const startCountdown = () => {
    setCountdown(180);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = () => {
    const error = validateEmail(email);
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
    if (verificationCode === '123456') {
      setCodeError('');
      onVerified();
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setCodeError('인증 코드가 올바르지 않습니다.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-[var(--knu-primary)]" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
          이메일 인증
        </h2>
        <p className="text-[var(--knu-text-secondary)]">강원대학교 이메일로 인증해주세요</p>
      </div>

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
          <LandingButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSendCode}
            disabled={isSending}
          >
            {isSending ? '전송 중...' : '인증 코드 전송'}
          </LandingButton>
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
              {countdown > 0 && (
                <div className="absolute right-4 top-11 text-sm font-semibold text-red-500">
                  {formatTime(countdown)}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>테스트용 인증 코드:</strong> 123456
              </p>
            </div>

            <div className="flex gap-3">
              <LandingButton
                variant="outline"
                size="lg"
                fullWidth
                onClick={handleSendCode}
                disabled={isSending || countdown > 0}
              >
                재전송{countdown > 0 ? ` (${formatTime(countdown)})` : ''}
              </LandingButton>
              <LandingButton variant="primary" size="lg" fullWidth onClick={handleVerifyCode}>
                인증 확인
              </LandingButton>
            </div>
          </>
        )}
      </div>

      {isVerified && (
        <LandingButton variant="primary" size="lg" fullWidth onClick={onNext}>
          다음 단계
        </LandingButton>
      )}
    </div>
  );
}
