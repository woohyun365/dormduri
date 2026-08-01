import { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { validatePasswordConfirm } from '@/auth/model/authFormValidation';
import { validatePasswordStructure as validatePassword } from '@repo/shared/auth/policy';
import { parseDisplayIdentityNickname } from '@repo/shared/user/identity';
import { StepHeader } from '@/auth/components/StepHeader';
import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import { VerifiedSchoolEmailCard } from '@/auth/components/VerifiedSchoolEmailCard';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { authApi } from '@/auth/api';
import type { SignupAccountData } from '../model/signup-account.types';
import { AccountCredentialsSection } from './account-identity/AccountCredentialsSection';
import { StepNavigation } from './StepNavigation';
import { SIGNUP_FEEDBACK_COPY } from '../model/signup-feedback.copy';

interface AccountCredentialsStepProps {
  email: string;
  accountData: SignupAccountData;
  onAccountDataChange: (data: SignupAccountData) => void;
  onNext: (data: SignupAccountData) => void | Promise<void>;
  onBack: () => void;
  disabled?: boolean;
  serverFieldErrors?: Partial<Record<'nickname' | 'password', string>>;
  onServerErrorClear?: () => void;
  validateSignupDraftAction?: typeof authApi.validateSignupDraft;
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
  validateSignupDraftAction = authApi.validateSignupDraft,
}: AccountCredentialsStepProps) {
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);
  const [policyCheckError, setPolicyCheckError] = useState('');
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
    const parsedNickname = parseDisplayIdentityNickname(accountData.nickname);
    const nicknameFormatError = parsedNickname.ok ? '' : parsedNickname.message;
    const passwordStructureError = validatePassword(accountData.password, email);
    const confirmError = validatePasswordConfirm(accountData.password, accountData.passwordConfirm);

    setNicknameError(nicknameFormatError);
    setPasswordError(passwordStructureError);
    setPasswordConfirmError(confirmError);

    if (!parsedNickname.ok) {
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

    setPolicyCheckError('');
    setIsCheckingPolicy(true);
    try {
      const validation = await validateSignupDraftAction({
        email,
        nickname: parsedNickname.value,
        password: accountData.password,
      });

      const nextNicknameError = validation.fieldErrors?.nickname ?? '';
      const nextPasswordError =
        validation.fieldErrors?.password ?? validation.fieldErrors?.email ?? '';

      setNicknameError(nextNicknameError);
      setPasswordError(nextPasswordError);

      if (!validation.success && !nextNicknameError && !nextPasswordError) {
        setPolicyCheckError(validation.error ?? SIGNUP_FEEDBACK_COPY.common.connectivity);
        return;
      }
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
        nickname: parsedNickname.value,
      };
      onAccountDataChange(nextAccountData);
      await onNext(nextAccountData);
    } catch {
      setPolicyCheckError(SIGNUP_FEEDBACK_COPY.common.connectivity);
    } finally {
      setIsCheckingPolicy(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<KeyRound className="size-8 text-(--knu-primary)" />}
        title="로그인 정보 만들기"
        description="닉네임과 비밀번호를 설정해요."
      />

      {policyCheckError ? (
        <AuthActionFeedback
          variant="connectivity"
          title={SIGNUP_FEEDBACK_COPY.credentials.unavailableTitle}
          description={policyCheckError}
        />
      ) : null}

      <VerifiedSchoolEmailCard email={email} />

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
        onBasicInfoChange={(nextAccountData) => {
          setPolicyCheckError('');
          onAccountDataChange(nextAccountData);
        }}
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
