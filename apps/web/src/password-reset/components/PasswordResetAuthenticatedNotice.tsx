import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

export function PasswordResetAuthenticatedNotice() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"
    >
      {PASSWORD_RESET_COPY.authenticatedNotice}
    </div>
  );
}
