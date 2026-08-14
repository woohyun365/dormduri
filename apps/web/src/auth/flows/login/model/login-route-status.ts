import { LOGIN_FEEDBACK_COPY } from './login-feedback.copy';

export type LoginRouteStatusVariant = 'success';

export interface LoginRouteStatus {
  variant: LoginRouteStatusVariant;
  title: string;
  message: string;
}

type LoginRouteSearchParams = Pick<URLSearchParams, 'get'> | null | undefined;

export function mapLoginRouteStatus(searchParams: LoginRouteSearchParams): LoginRouteStatus | null {
  if (searchParams?.get('reset') !== 'success') return null;

  return {
    variant: 'success',
    title: LOGIN_FEEDBACK_COPY.passwordResetComplete.title,
    message: LOGIN_FEEDBACK_COPY.passwordResetComplete.description,
  };
}
