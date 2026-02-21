'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';
import { InputField } from '@/signup/components/InputField';
import { LandingButton } from '@/landing/components/landing/LandingButton';
import { ProgressBar } from '@/signup/components/ProgressBar';
import { Mail, CheckCircle, Lock } from 'lucide-react';

type ResetStep = 'email' | 'verification' | 'newPassword' | 'complete';

export default function PasswordReset() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isCodeSent, setIsCodeSent] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

  const validateEmail = (email: string) => {
    if (!email) {
      return '이메일을 입력해주세요.';
    }
    if (!email.endsWith('@kangwon.ac.kr')) {
      return '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.';
    }
    return '';
  };

  const handleSendCode = () => {
    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    setEmailError('');
    setIsCodeSent(true);
    startCountdown();

    // Move to verification step automatically after showing success
    setTimeout(() => {
      setCurrentStep('verification');
    }, 500);
  };

  const handleVerifyCode = () => {
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      return;
    }

    if (verificationCode === '123456') {
      setCodeError('');
      setCurrentStep('newPassword');
    } else {
      setCodeError('인증 코드가 올바르지 않습니다.');
    }
  };

  const handleResetPassword = () => {
    let hasError = false;

    if (!newPassword) {
      setPasswordError('비밀번호를 입력해주세요.');
      hasError = true;
    } else if (newPassword.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 합니다.');
      hasError = true;
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      setPasswordError('비밀번호는 영문과 숫자를 포함해야 합니다.');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('비밀번호가 일치하지 않습니다.');
      hasError = true;
    } else {
      setConfirmError('');
    }

    if (!hasError) {
      setCurrentStep('complete');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <AuthHeader
        showBack={currentStep !== 'email' && currentStep !== 'complete'}
        onBack={() => {
          if (currentStep === 'verification') setCurrentStep('email');
          if (currentStep === 'newPassword') setCurrentStep('verification');
        }}
      />

      <div className="mx-auto max-w-md px-5 py-12 md:py-16">
        {/* Progress Bar - Show for steps 1-3 */}
        {currentStep !== 'complete' && (
          <div className="mb-8">
            <ProgressBar
              currentStep={currentStep === 'email' ? 1 : currentStep === 'verification' ? 2 : 3}
              totalSteps={3}
            />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border-2 border-[var(--knu-border)] p-6 md:p-8">
          {/* Step 1: Email */}
          {currentStep === 'email' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-[var(--knu-primary)]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
                  비밀번호 찾기
                </h2>
                <p className="text-[var(--knu-text-secondary)]">
                  가입한 이메일로 인증 코드를 보내드립니다
                </p>
              </div>

              <InputField
                label="이메일"
                type="email"
                placeholder="example@kangwon.ac.kr"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  setEmailError('');
                }}
                error={emailError}
              />

              <LandingButton variant="primary" size="lg" fullWidth onClick={handleSendCode}>
                인증 코드 전송
              </LandingButton>

              <div className="text-center pt-4">
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm font-semibold text-[var(--knu-primary)] hover:text-[var(--knu-primary-hover)] transition-colors"
                >
                  로그인으로 돌아가기
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Verification */}
          {currentStep === 'verification' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-[var(--knu-primary)]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
                  인증 코드 확인
                </h2>
                <p className="text-[var(--knu-text-secondary)]">
                  {email}로 전송된 코드를 입력해주세요
                </p>
              </div>

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

              {process.env.NODE_ENV === 'development' && (
                <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    <strong>테스트용 인증 코드:</strong> 123456
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <LandingButton
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={handleSendCode}
                  disabled={!isCodeSent}
                >
                  재전송
                </LandingButton>
                <LandingButton variant="primary" size="lg" fullWidth onClick={handleVerifyCode}>
                  확인
                </LandingButton>
              </div>
            </div>
          )}

          {/* Step 3: New Password */}
          {currentStep === 'newPassword' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-[var(--knu-primary)]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
                  새 비밀번호 설정
                </h2>
                <p className="text-[var(--knu-text-secondary)]">새로운 비밀번호를 입력해주세요</p>
              </div>

              <InputField
                label="새 비밀번호"
                type="password"
                placeholder="영문, 숫자 포함 8자 이상"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  setPasswordError('');
                }}
                error={passwordError}
              />

              <InputField
                label="비밀번호 확인"
                type="password"
                placeholder="비밀번호를 다시 입력해주세요"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setConfirmError('');
                }}
                error={confirmError}
              />

              <LandingButton variant="primary" size="lg" fullWidth onClick={handleResetPassword}>
                비밀번호 재설정
              </LandingButton>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-3">
                  비밀번호 재설정 완료
                </h2>
                <p className="text-lg text-[var(--knu-text-secondary)]">
                  새로운 비밀번호로 로그인해주세요
                </p>
              </div>

              <div className="pt-4">
                <LandingButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => router.push('/login')}
                >
                  로그인하러 가기
                </LandingButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
