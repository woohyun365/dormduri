import {
  passwordMatchesEmailIdentity,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PRINTABLE_ASCII_REGEX,
} from '@repo/shared/auth/policy';
import { Circle, CircleCheck, CircleX, type LucideIcon } from 'lucide-react';

interface PasswordRequirementListProps {
  password: string;
  email: string;
  confirmPassword?: string;
}

type RequirementState = 'idle' | 'met' | 'error';

interface PasswordRequirement {
  label: string;
  state: RequirementState;
}

const PASSWORD_WHITESPACE_REGEX = /\p{White_Space}/u;

function toState(isReady: boolean, isMet: boolean): RequirementState {
  if (!isReady) return 'idle';
  return isMet ? 'met' : 'error';
}

const REQUIREMENT_STYLE: Record<RequirementState, string> = {
  idle: 'text-(--knu-text-tertiary)',
  met: 'text-emerald-700',
  error: 'text-red-600',
};

const REQUIREMENT_ICON: Record<RequirementState, LucideIcon> = {
  idle: Circle,
  met: CircleCheck,
  error: CircleX,
};

const REQUIREMENT_A11Y_STATUS: Record<RequirementState, string> = {
  idle: '확인 전',
  met: '충족',
  error: '확인 필요',
};

export function PasswordRequirementList({
  password,
  email,
  confirmPassword,
}: PasswordRequirementListProps) {
  const hasValue = password.length > 0;
  const hasWhitespace = PASSWORD_WHITESPACE_REGEX.test(password);
  const usesAllowedCharacters = PASSWORD_PRINTABLE_ASCII_REGEX.test(password);

  const requirements: PasswordRequirement[] = [
    {
      state: toState(
        hasValue,
        password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
      ),
      label: `${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`,
    },
    {
      state: toState(hasValue && !hasWhitespace, usesAllowedCharacters),
      label: '영문·숫자·기호만',
    },
    {
      state: toState(hasValue, !hasWhitespace),
      label: '공백 없음',
    },
    {
      state: toState(hasValue, !passwordMatchesEmailIdentity(password, email)),
      label: '이메일 정보와 다름',
    },
  ];

  if (confirmPassword !== undefined) {
    requirements.push({
      state: toState(confirmPassword.length > 0, hasValue && password === confirmPassword),
      label: '비밀번호 확인 일치',
    });
  }

  return (
    <ul
      aria-label="비밀번호 조건"
      aria-live="polite"
      className="mt-2 grid grid-cols-1 gap-1 text-xs leading-5 sm:grid-cols-2 sm:gap-x-3"
    >
      {requirements.map(({ state, label }) => {
        const Icon = REQUIREMENT_ICON[state];

        return (
          <li key={label} className={`flex items-start gap-1.5 ${REQUIREMENT_STYLE[state]}`}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {label}
              <span className="sr-only">: {REQUIREMENT_A11Y_STATUS[state]}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
