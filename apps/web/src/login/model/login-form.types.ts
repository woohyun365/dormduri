import type { FormEvent } from 'react';
import type { LoginResponse } from '@repo/shared/auth/response';

export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export type LoginUiStatus =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'invalid'
  | 'locked'
  | 'throttled'
  | 'network-error'
  | 'server-error';

export interface LoginUiErrorState {
  status: Exclude<LoginUiStatus, 'idle' | 'submitting' | 'success'>;
  message: string;
  lockedEmail?: string;
  remainingSeconds?: number;
  retryAfterSeconds?: number;
}

export type LoginFormSubmitEvent = FormEvent<HTMLFormElement>;

export type LoginFn = (
  email: LoginFormValues['email'],
  password: LoginFormValues['password'],
  rememberMe: LoginFormValues['rememberMe'],
) => Promise<LoginResponse>;

export type LoginSubmitResult = Awaited<ReturnType<LoginFn>>;

export type LoginSuccessHandler = (target: string) => void;
