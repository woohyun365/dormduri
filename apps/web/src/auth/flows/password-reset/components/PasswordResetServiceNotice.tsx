import Link from 'next/link';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

export function PasswordResetServiceNotice() {
  return (
    <p className="keep-all mt-2 text-xs leading-5 text-(--knu-text-tertiary)">
      {PASSWORD_RESET_COPY.serviceNotice.text}{' '}
      <Link
        href="/terms"
        className="inline-block whitespace-nowrap underline sm:inline sm:whitespace-normal"
      >
        {PASSWORD_RESET_COPY.serviceNotice.linkLabel}
      </Link>
    </p>
  );
}
