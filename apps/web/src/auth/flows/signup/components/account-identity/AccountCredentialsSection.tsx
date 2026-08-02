import type { RefObject } from 'react';
import { PASSWORD_MIN_LENGTH } from '@repo/shared/auth/policy';
import { InputField } from '@/auth/components/form/InputField';
import { PasswordRequirementList } from '@/auth/components';
import type { SignupAccountData } from '../../model/signup-account.types';
import type { SignupNicknameValidationState } from '../../model/signup-nickname-validation.types';
import { NicknameValidationField } from './NicknameValidationField';

interface AccountCredentialsSectionProps {
  email: string;
  basicInfo: SignupAccountData;
  nicknameError: string;
  nicknameValidationState: SignupNicknameValidationState;
  passwordError: string;
  passwordConfirmError: string;
  nicknameRef: RefObject<HTMLInputElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  passwordConfirmRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onBasicInfoChange: (data: SignupAccountData) => void;
  onNicknameErrorClear: () => void;
  onNicknameCheck: () => void;
  onPasswordErrorClear: () => void;
  onPasswordConfirmErrorClear: () => void;
}

export function AccountCredentialsSection({
  email,
  basicInfo,
  nicknameError,
  nicknameValidationState,
  passwordError,
  passwordConfirmError,
  nicknameRef,
  passwordRef,
  passwordConfirmRef,
  disabled,
  onBasicInfoChange,
  onNicknameErrorClear,
  onNicknameCheck,
  onPasswordErrorClear,
  onPasswordConfirmErrorClear,
}: AccountCredentialsSectionProps) {
  return (
    <section aria-label="로그인 정보 입력" className="space-y-4">
      <NicknameValidationField
        inputRef={nicknameRef}
        value={basicInfo.nickname}
        onChange={(value) => {
          onBasicInfoChange({ ...basicInfo, nickname: value });
          onNicknameErrorClear();
        }}
        error={nicknameError}
        state={nicknameValidationState}
        disabled={disabled}
        onCheck={onNicknameCheck}
      />

      <div>
        <InputField
          ref={passwordRef}
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder={`${PASSWORD_MIN_LENGTH}자 이상 입력`}
          value={basicInfo.password}
          onChange={(value) => {
            onBasicInfoChange({ ...basicInfo, password: value });
            onPasswordErrorClear();
          }}
          error={passwordError}
          disabled={disabled}
          required
        />
        <PasswordRequirementList password={basicInfo.password} email={email} />
      </div>

      <InputField
        ref={passwordConfirmRef}
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        placeholder="비밀번호 다시 입력"
        value={basicInfo.passwordConfirm}
        disabled={disabled}
        required
        onChange={(value) => {
          onBasicInfoChange({ ...basicInfo, passwordConfirm: value });
          onPasswordConfirmErrorClear();
        }}
        error={passwordConfirmError}
      />
    </section>
  );
}
