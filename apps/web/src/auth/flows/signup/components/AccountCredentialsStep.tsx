import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { validatePasswordConfirm } from '@/auth/model/authFormValidation';
import { validatePasswordStructure as validatePassword } from '@repo/shared/auth/policy';
import { validateDisplayIdentityNicknameStructure as validateNickname } from '@repo/shared/user/identity';
import { StepHeader } from '@/auth/components/StepHeader';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { authApi } from '@/auth/api';
import type { SignupAccountData } from '../model/signup-account.types';
import { AccountCredentialsSection } from './account-identity/AccountCredentialsSection';
import { StepNavigation } from './StepNavigation';

interface AccountCredentialsStepProps {
  email: string;
  accountData: SignupAccountData;
  onAccountDataChange: (data: SignupAccountData) => void;
  onNext: (data: SignupAccountData) => void | Promise<void>;
  onBack: () => void;
  disabled?: boolean;
  serverFieldErrors?: Partial<Record<'nickname' | 'password', string>>;
  onServerErrorClear?: () => void;
}

export function AccountCredentialsStep({
  email,
  accountData,
  onAccountDataChange,
  onNext,
  onBack,
  disabled = false,
  serverFieldErrors,
  onServerErrorClear,
}: AccountCredentialsStepProps) {
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const displayedNicknameError = nicknameError || serverFieldErrors?.nickname || '';
  const displayedPasswordError = passwordError || serverFieldErrors?.password || '';

  useEffect(() => {
    if (serverFieldErrors?.nickname) {
      focusAndScroll(nicknameRef.current);
      return;
    }
    if (serverFieldErrors?.password) {
      focusAndScroll(passwordRef.current);
    }
  }, [serverFieldErrors?.nickname, serverFieldErrors?.password]);

  const handleNext = async () => {
    const nicknameFormatError = validateNickname(accountData.nickname);
    const passwordStructureError = validatePassword(accountData.password, email);
    const confirmError = validatePasswordConfirm(accountData.password, accountData.passwordConfirm);

    setNicknameError(nicknameFormatError);
    setPasswordError(passwordStructureError);
    setPasswordConfirmError(confirmError);

    if (nicknameFormatError) {
      focusAndScroll(nicknameRef.current);
      return;
    }
    if (passwordStructureError) {
      focusAndScroll(passwordRef.current);
      return;
    }
    if (confirmError) {
      focusAndScroll(passwordConfirmRef.current);
      return;
    }

    setIsCheckingPolicy(true);
    const validation = await authApi.validateSignupDraft({
      email,
      nickname: accountData.nickname,
      password: accountData.password,
    });
    setIsCheckingPolicy(false);

    const nextNicknameError = validation.fieldErrors?.nickname ?? '';
    const nextPasswordError =
      validation.fieldErrors?.password ?? validation.fieldErrors?.email ?? '';

    setNicknameError(nextNicknameError);
    setPasswordError(nextPasswordError);

    if (nextNicknameError) {
      focusAndScroll(nicknameRef.current);
      return;
    }
    if (nextPasswordError) {
      focusAndScroll(passwordRef.current);
      return;
    }

    const nextAccountData = {
      ...accountData,
      nickname: accountData.nickname.trim(),
    };
    onAccountDataChange(nextAccountData);
    await onNext(nextAccountData);
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<KeyRound className="size-8 text-(--knu-primary)" />}
        title="로그인 정보 만들기"
        description="닉네임과 비밀번호를 설정해요."
      />

      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-indigo-100">
          <CheckCircle2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-indigo-600">인증된 학교 이메일</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{email}</p>
        </div>
      </div>

      <AccountCredentialsSection
        email={email}
        basicInfo={accountData}
        nicknameError={displayedNicknameError}
        passwordError={displayedPasswordError}
        passwordConfirmError={passwordConfirmError}
        nicknameRef={nicknameRef}
        passwordRef={passwordRef}
        passwordConfirmRef={passwordConfirmRef}
        disabled={disabled}
        onBasicInfoChange={onAccountDataChange}
        onNicknameErrorClear={() => {
          setNicknameError('');
          onServerErrorClear?.();
        }}
        onPasswordErrorClear={() => {
          setPasswordError('');
          onServerErrorClear?.();
        }}
        onPasswordConfirmErrorClear={() => setPasswordConfirmError('')}
      />

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        nextLabel={isCheckingPolicy ? '확인 중...' : '계속하기'}
        disabled={disabled || isCheckingPolicy}
      />
    </div>
  );
}
