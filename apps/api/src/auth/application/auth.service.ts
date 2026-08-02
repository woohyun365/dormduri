import { Injectable } from '@nestjs/common';
import type { SignupNicknameValidationResponse } from '@repo/shared/auth/response';
import { AuthCredentialUseCases } from '../credentials/auth-credential-use-cases.service.js';
import type {
  ChangePasswordResult,
  GenericSuccessResult,
  LoginResult,
  RenewSessionResult,
  SessionStatusResult,
  SignupInput,
} from '../domain/auth.types.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import { AuthRegistrationUseCases } from '../registration/auth-registration-use-cases.service.js';
import { AuthSessionUseCases } from '../sessions/auth-session-use-cases.service.js';
import type { AuthenticatedUserContext } from './auth-actor-context.types.js';
import { AuthVerificationUseCases } from '../verification/auth-verification-use-cases.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly verificationUseCases: AuthVerificationUseCases,
    private readonly registrationUseCases: AuthRegistrationUseCases,
    private readonly credentialUseCases: AuthCredentialUseCases,
    private readonly sessionUseCases: AuthSessionUseCases,
  ) {}

  sendSignupCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    return this.verificationUseCases.sendSignupCode(email, requestIpOrContext);
  }

  sendResetCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    return this.verificationUseCases.sendResetCode(email, requestIpOrContext);
  }

  verifyEmailCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.verificationUseCases.verifyEmailCode(email, code, requestContext);
  }

  verifyResetCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.verificationUseCases.verifyResetCode(email, code, requestContext);
  }

  getSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<SessionStatusResult> {
    return this.sessionUseCases.getSession(token, requestContext);
  }

  validateSignupNickname(
    nickname: string,
    verificationGrant: string | null,
  ): Promise<SignupNicknameValidationResponse> {
    return this.registrationUseCases.validateSignupNickname(nickname, verificationGrant);
  }

  signup(input: SignupInput, verificationGrant: string | null = null): Promise<LoginResult> {
    return this.registrationUseCases.signup(input, verificationGrant);
  }

  login(
    email: string,
    password: string,
    rememberMe: boolean,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    return this.credentialUseCases.login(email, password, rememberMe, requestContext);
  }

  resetPassword(
    verificationGrant: string | null,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.credentialUseCases.resetPassword(verificationGrant, newPassword, requestContext);
  }

  changePassword(
    authUser: AuthenticatedUserContext,
    currentPassword: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<ChangePasswordResult> {
    return this.credentialUseCases.changePassword(
      authUser,
      currentPassword,
      newPassword,
      requestContext,
    );
  }

  renewSession(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    return this.sessionUseCases.renewSession(renewalToken, requestContext);
  }

  logout(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.sessionUseCases.logout(token, renewalToken, requestContext);
  }
}
