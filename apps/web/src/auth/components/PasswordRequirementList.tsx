import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@repo/shared/auth/policy';

interface PasswordRequirementListProps {
  password: string;
  email: string;
}

export function PasswordRequirementList({ password, email }: PasswordRequirementListProps) {
  const hasValue = password.length > 0;

  const requirements = [
    {
      met: hasValue && password.length >= PASSWORD_MIN_LENGTH,
      label: `${PASSWORD_MIN_LENGTH}자 이상`,
      failStyle: 'text-(--knu-text-tertiary)',
    },
    {
      met: hasValue && password.length <= PASSWORD_MAX_LENGTH,
      label: `${PASSWORD_MAX_LENGTH}자 이하`,
      failStyle:
        hasValue && password.length > PASSWORD_MAX_LENGTH
          ? 'text-red-600'
          : 'text-(--knu-text-tertiary)',
    },
    {
      met: hasValue && /[a-zA-Z]/.test(password),
      label: '영문 포함',
      failStyle: 'text-(--knu-text-tertiary)',
    },
    {
      met: hasValue && /\d/.test(password),
      label: '숫자 포함',
      failStyle: 'text-(--knu-text-tertiary)',
    },
    {
      met: hasValue && password.toLowerCase() !== email.toLowerCase(),
      label: '이메일과 다름',
      failStyle:
        hasValue && password.toLowerCase() === email.toLowerCase()
          ? 'text-red-600'
          : 'text-(--knu-text-tertiary)',
    },
  ];

  return (
    <ul
      aria-label="비밀번호 조건"
      className="mt-2 grid min-h-15 grid-cols-2 gap-x-3 gap-y-1 text-xs"
    >
      {requirements.map(({ met, label, failStyle }) => (
        <li key={label} className={met ? 'text-green-600' : failStyle}>
          {met ? '✓' : failStyle === 'text-red-600' ? '✗' : '○'} {label}
        </li>
      ))}
    </ul>
  );
}
