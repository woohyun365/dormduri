import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { validatePasswordConfirm } from '@/auth/model/authFormValidation';
import { validatePasswordStructure as validatePassword } from '@repo/shared/auth/policy';
import { parseDisplayIdentityNickname } from '@repo/shared/user/identity';
import { StepHeader } from '@/auth/components/StepHeader';
import { VerifiedSchoolEmailCard } from '@/auth/components/VerifiedSchoolEmailCard';
import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { authApi } from '@/auth/api';
import type { SignupAccountData } from '../model/signup-account.types';
import { AccountCredentialsSection } from './account-identity/AccountCredentialsSection';
import { StepNavigation } from './StepNavigation';
import {
  useSignupNicknameValidation,
  type ValidateSignupNicknameAction,
} from '../hooks/useSignupNicknameValidation';
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
  onEmailProofExpired?: () => void;
  validateSignupNicknameAction?: ValidateSignupNicknameAction;
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
  onEmailProofExpired,
  validateSignupNicknameAction = authApi.validateSignupNickname,
}: AccountCredentialsStepProps) {
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const displayedNicknameError = nicknameError || serverFieldErrors?.nickname || '';
  const displayedPasswordError = passwordError || serverFieldErrors?.password || '';
  const handleCanonicalNickname = useCallback(
    (nickname: string) => {
      if (nickname === accountData.nickname) return;
      onAccountDataChange({ ...accountData, nickname });
    },
    [accountData, onAccountDataChange],
  );
  const nicknameValidation = useSignupNicknameValidation({
    nickname: accountData.nickname,
    serverError: serverFieldErrors?.nickname,
    validateAction: validateSignupNicknameAction,
    onCanonicalNickname: handleCanonicalNickname,
  });
  const nicknameActionFeedback =
    nicknameValidation.state.status === 'unavailable'
      ? {
          variant: 'connectivity' as const,
          title: SIGNUP_FEEDBACK_COPY.credentials.nickname.unavailableTitle,
          description: nicknameValidation.state.message,
        }
      : nicknameValidation.state.status === 'expired'
        ? {
            variant: 'warning' as const,
            title: SIGNUP_FEEDBACK_COPY.credentials.nickname.expiredTitle,
            description: nicknameValidation.state.message,
          }
        : null;

  useEffect(() => {
    if (serverFieldErrors?.nickname) {
      focusAndScroll(nicknameRef.current);
      return;
    }
    if (serverFieldErrors?.password) {
      focusAndScroll(passwordRef.current);
    }
  }, [serverFieldErrors?.nickname, serverFieldErrors?.password]);

  const handleNicknameCheck = async () => {
    setNicknameError('');
    onServerErrorClear?.();
    const result = await nicknameValidation.validate();
    if (result === 'expired') {
      onEmailProofExpired?.();
      return;
    }
    if (result === 'rejected') focusAndScroll(nicknameRef.current);
  };

  const handleNext = async () => {
    const parsedNickname = parseDisplayIdentityNickname(accountData.nickname);
    const nicknameFormatError = parsedNickname.ok ? '' : parsedNickname.message;
    const passwordStructureError = validatePassword(accountData.password, email);
    const confirmError = validatePasswordConfirm(accountData.password, accountData.passwordConfirm);

    setNicknameError(nicknameFormatError);
    setPasswordError(passwordStructureError);
    setPasswordConfirmError(confirmError);

    if (!parsedNickname.ok || !nicknameValidation.requireCurrentValidation()) {
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

    const nextAccountData = {
      ...accountData,
      nickname: parsedNickname.value,
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

      {nicknameActionFeedback ? (
        <AuthActionFeedback
          variant={nicknameActionFeedback.variant}
          title={nicknameActionFeedback.title}
          description={nicknameActionFeedback.description}
          testId="signup-nickname-action-feedback"
        />
      ) : null}

      <VerifiedSchoolEmailCard email={email} />

      <AccountCredentialsSection
        email={email}
        basicInfo={accountData}
        nicknameError={displayedNicknameError}
        nicknameValidationState={nicknameValidation.state}
        passwordError={displayedPasswordError}
        passwordConfirmError={passwordConfirmError}
        nicknameRef={nicknameRef}
        passwordRef={passwordRef}
        passwordConfirmRef={passwordConfirmRef}
        disabled={disabled}
        onBasicInfoChange={(nextAccountData) => {
          if (nextAccountData.nickname !== accountData.nickname) {
            nicknameValidation.invalidate(nextAccountData.nickname);
          }
          onAccountDataChange(nextAccountData);
        }}
        onNicknameErrorClear={() => {
          setNicknameError('');
          onServerErrorClear?.();
        }}
        onNicknameCheck={() => void handleNicknameCheck()}
        onPasswordErrorClear={() => {
          setPasswordError('');
          onServerErrorClear?.();
        }}
        onPasswordConfirmErrorClear={() => setPasswordConfirmError('')}
      />

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        nextLabel="계속하기"
        disabled={disabled || !nicknameValidation.isCurrentNicknameAvailable}
      />
    </div>
  );
}
