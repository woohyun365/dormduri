import type { RefObject } from 'react';
import { DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH } from '@repo/shared/user/identity';
import { InputField } from '@/auth/components/form/InputField';
import { PasswordRequirementList } from '@/auth/components';
import { PASSWORD_MIN_LENGTH } from '@/auth/model';
import type { SignupAccountData } from '../../model/signup-account.types';

interface AccountCredentialsSectionProps {
  email: string;
  basicInfo: SignupAccountData;
  nicknameError: string;
  passwordError: string;
  passwordConfirmError: string;
  nicknameRef: RefObject<HTMLInputElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  passwordConfirmRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onBasicInfoChange: (data: SignupAccountData) => void;
  onNicknameErrorClear: () => void;
  onPasswordErrorClear: () => void;
  onPasswordConfirmErrorClear: () => void;
}

export function AccountCredentialsSection({
  email,
  basicInfo,
  nicknameError,
  passwordError,
  passwordConfirmError,
  nicknameRef,
  passwordRef,
  passwordConfirmRef,
  disabled,
  onBasicInfoChange,
  onNicknameErrorClear,
  onPasswordErrorClear,
  onPasswordConfirmErrorClear,
}: AccountCredentialsSectionProps) {
  return (
    <section aria-label="로그인 정보 입력" className="space-y-4">
      <InputField
        ref={nicknameRef}
        label="닉네임"
        type="text"
        placeholder="닉네임 2~8자"
        value={basicInfo.nickname}
        onChange={(value) => {
          onBasicInfoChange({ ...basicInfo, nickname: value });
          onNicknameErrorClear();
        }}
        error={nicknameError}
        helper="다른 사용자에게 보이는 이름이에요."
        maxLength={DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH}
        disabled={disabled}
        required
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
