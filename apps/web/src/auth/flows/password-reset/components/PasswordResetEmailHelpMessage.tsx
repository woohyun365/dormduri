import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

export function PasswordResetEmailHelpMessage() {
  return (
    <span className="block">
      {PASSWORD_RESET_COPY.emailHelp.prefix}
      <span className="font-semibold text-(--knu-primary)">
        {PASSWORD_RESET_COPY.emailHelp.highlight}
      </span>
      {PASSWORD_RESET_COPY.emailHelp.suffix}
    </span>
  );
}
