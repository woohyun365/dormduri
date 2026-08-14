import { validateKnuEmailFormat as validateKnuEmail } from '@repo/shared/auth/policy';
import type { LoginFieldErrors, LoginFormValues } from './login-form.types';

export const INITIAL_LOGIN_FORM_VALUES: LoginFormValues = {
  email: '',
  password: '',
  rememberMe: false,
};

export function validateLoginForm(values: LoginFormValues): LoginFieldErrors {
  const email = validateKnuEmail(values.email);
  const password = values.password ? '' : '비밀번호를 입력해주세요.';

  return {
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
  };
}

export function hasLoginFieldErrors(errors: LoginFieldErrors): boolean {
  return Boolean(errors.email || errors.password);
}
