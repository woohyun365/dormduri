import { Injectable } from '@nestjs/common';
import type {
  ChangePasswordResult,
  GenericSuccessResult,
  LoginResult,
  RenewSessionResult,
  SessionStatusResult,
  SignupInput,
} from '../domain/auth.types.js';
import type { SignupDraftValidationResponse } from '@repo/shared/auth-response';
import type { AuthenticatedUserContext } from './auth-actor-context.types.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import { AuthUseCases } from './auth-use-cases.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly useCases: AuthUseCases) {}

  sendSignupCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    return this.useCases.sendSignupCode(email, requestIpOrContext);
  }

  sendResetCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    return this.useCases.sendResetCode(email, requestIpOrContext);
  }

  verifyEmailCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.useCases.verifyEmailCode(email, code, requestContext);
  }

  verifyResetCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.useCases.verifyResetCode(email, code, requestContext);
  }

  getSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<SessionStatusResult> {
    return this.useCases.getSession(token, requestContext);
  }

  validateSignupDraft(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupDraftValidationResponse> {
    return this.useCases.validateSignupDraft(input);
  }

  signup(input: SignupInput): Promise<LoginResult> {
    return this.useCases.signup(input);
  }

  login(
    email: string,
    password: string,
    rememberMe: boolean,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    return this.useCases.login(email, password, rememberMe, requestContext);
  }

  resetPassword(
    email: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.useCases.resetPassword(email, newPassword, requestContext);
  }

  changePassword(
    authUser: AuthenticatedUserContext,
    currentPassword: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<ChangePasswordResult> {
    return this.useCases.changePassword(authUser, currentPassword, newPassword, requestContext);
  }

  renewSession(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    return this.useCases.renewSession(renewalToken, requestContext);
  }

  logout(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.useCases.logout(token, renewalToken, requestContext);
  }
}
