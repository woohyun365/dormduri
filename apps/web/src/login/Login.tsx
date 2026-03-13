'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';
import { InputField } from '@/components/form/InputField';
import { Checkbox } from '@/components/form/Checkbox';
import { Button } from '@/components/Button';

import { validateKnuEmail } from '@/utils/validation';
import { authApi } from '@/api/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCountdown } from '@/hooks/useCountdown';
import { LOGIN_LOCKOUT_SECONDS } from '@/constants/auth';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Lock, AlertCircle, Timer } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useCurrentUser();

  // 이미 로그인 상태면 게이트웨이(/)로 리다이렉트
  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace('/');
    }
  }, [isAuthLoading, user, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const {
    isActive: isLocked,
    start: startLockout,
    formatTime: formatLockoutTime,
  } = useCountdown(LOGIN_LOCKOUT_SECONDS);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    setEmailError('');
    setLoginError('');
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setPasswordError('');
    setLoginError('');
  }, []);

  const handleLogin = async () => {
    const emailErr = validateKnuEmail(email);
    const passwordErr = password ? '' : '비밀번호를 입력해주세요.';

    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setLoginError('');

    if (emailErr || passwordErr) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await authApi.login(email, password, rememberMe);
      if (result.success) {
        router.replace('/');
      } else if (result.locked && result.remainingSeconds) {
        startLockout(result.remainingSeconds);
        setLoginError(result.error ?? '계정이 일시적으로 잠겼습니다.');
      } else {
        setLoginError(result.error ?? '이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setLoginError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  // auth 체크 중이거나 이미 로그인 상태면 UI를 렌더링하지 않음 (깜빡임 방지)
  if (isAuthLoading || user) {
    return <div className="min-h-screen bg-[var(--knu-background-alt)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <AuthHeader showBack={false} />

      <div className="mx-auto max-w-md px-5 py-12 md:py-20">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <Image
            src="/knu_logo.svg"
            alt="KNU 로고"
            width={80}
            height={80}
            className="rounded-full mx-auto mb-6 shadow-lg"
          />
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-3">
            로그인
          </h1>
          <p className="text-[var(--knu-text-secondary)]">KNU 룸메에 오신 것을 환영합니다</p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border-2 border-[var(--knu-border)] p-6 md:p-8 mb-6"
        >
          {isLocked && (
            <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-start gap-3">
              <Timer className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 font-medium">{loginError}</p>
                <p className="text-sm text-amber-700 mt-1">
                  남은 시간: <strong>{formatLockoutTime()}</strong>
                </p>
              </div>
            </div>
          )}

          {loginError && !isLocked && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-900 font-medium">{loginError}</p>
            </div>
          )}

          <div className="space-y-5">
            <InputField
              label="이메일"
              type="email"
              placeholder="example@kangwon.ac.kr"
              value={email}
              onChange={handleEmailChange}
              error={emailError}
              disabled={isLoading}
            />

            <InputField
              label="비밀번호"
              type="password"
              placeholder="비밀번호를 입력해주세요"
              value={password}
              onChange={handlePasswordChange}
              error={passwordError}
              disabled={isLoading}
            />

            <div>
              <div className="flex items-center justify-between">
                <Checkbox label="로그인 유지" checked={rememberMe} onChange={setRememberMe} />
                <button
                  type="button"
                  onClick={() => router.push('/password-reset')}
                  className="text-sm font-semibold text-[var(--knu-primary)] hover:text-[var(--knu-primary-hover)] transition-colors"
                >
                  비밀번호 찾기
                </button>
              </div>
              {rememberMe && (
                <p className="mt-1.5 ml-6 text-xs text-[var(--knu-text-tertiary)]">
                  브라우저를 닫아도 로그인 상태가 유지됩니다
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                type="submit"
                disabled={isLoading || isLocked}
              >
                <Lock className="w-5 h-5" />
                {isLoading ? '로그인 중...' : isLocked ? '계정 잠금 중' : '로그인'}
              </Button>
            </div>
          </div>
        </form>

        {/* Signup Link */}
        <div className="text-center mt-6">
          <p className="text-[var(--knu-text-secondary)] mb-4">아직 계정이 없으신가요?</p>
          <Button variant="outline" size="lg" fullWidth onClick={() => router.push('/signup')}>
            <Mail className="w-5 h-5" />
            이메일로 회원가입
          </Button>
        </div>

        {/* Additional Links */}
        <div className="mt-12 pt-8 border-t border-[var(--knu-border)] text-center">
          <div className="flex justify-center gap-6 text-sm">
            <Link
              href="/terms"
              className="text-[var(--knu-text-tertiary)] hover:text-[var(--knu-primary)] transition-colors"
            >
              이용약관
            </Link>
            <span className="text-[var(--knu-text-tertiary)]">|</span>
            <Link
              href="/privacy"
              className="text-[var(--knu-text-tertiary)] hover:text-[var(--knu-primary)] transition-colors"
            >
              개인정보처리방침
            </Link>
            <span className="text-[var(--knu-text-tertiary)]">|</span>
            <a
              href="mailto:knu-roommate@kangwon.ac.kr"
              className="text-[var(--knu-text-tertiary)] hover:text-[var(--knu-primary)] transition-colors"
            >
              문의하기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
