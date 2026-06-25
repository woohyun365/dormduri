import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/auth/model';

interface PasswordRequirementListProps {
  password: string;
  email: string;
}

export function PasswordRequirementList({ password, email }: PasswordRequirementListProps) {
  if (password.length === 0) return null;

  const requirements = [
    {
      met: password.length >= PASSWORD_MIN_LENGTH,
      label: `${PASSWORD_MIN_LENGTH}자 이상`,
      failStyle: 'text-[var(--knu-text-tertiary)]',
    },
    {
      met: password.length <= PASSWORD_MAX_LENGTH,
      label: `${PASSWORD_MAX_LENGTH}자 이하`,
      failStyle: 'text-red-600',
    },
    {
      met: /[a-zA-Z]/.test(password),
      label: '영문 포함',
      failStyle: 'text-[var(--knu-text-tertiary)]',
    },
    {
      met: /\d/.test(password),
      label: '숫자 포함',
      failStyle: 'text-[var(--knu-text-tertiary)]',
    },
    {
      met: password.toLowerCase() !== email.toLowerCase(),
      label: '이메일과 다름',
      failStyle: 'text-red-600',
    },
  ];

  return (
    <ul className="mt-2 space-y-1 text-xs">
      {requirements.map(({ met, label, failStyle }) => (
        <li key={label} className={met ? 'text-green-600' : failStyle}>
          {met ? '✓' : failStyle === 'text-red-600' ? '✗' : '○'} {label}
        </li>
      ))}
    </ul>
  );
}
