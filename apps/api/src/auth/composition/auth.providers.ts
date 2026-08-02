import type { Provider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import emailConfig from '../../config/email.config.js';
import { AuthenticatedUserGuard } from '../access/authenticated-user.guard.js';
import {
  EMAIL_SENDER,
  EMAIL_SENDER_DELEGATE,
  type EmailSender,
} from '../adapters/email/email-sender.interface.js';
import { selectEmailSenderDelegate } from '../adapters/email/email-sender.provider.js';
import { MonitoredEmailSenderService } from '../adapters/email/monitored-email-sender.service.js';
import { SesEmailSenderService } from '../adapters/email/ses-email-sender.service.js';
import { StubEmailSenderService } from '../adapters/email/stub-email-sender.service.js';
import { AuthActorContextResolver } from '../application/auth-actor-context.resolver.js';
import { AuthService } from '../application/auth.service.js';
import { AuthCredentialUseCases } from '../credentials/auth-credential-use-cases.service.js';
import { AuthPasswordHashPolicy } from '../credentials/auth-password-hash.adapter.js';
import { ChangePasswordAdmissionService } from '../credentials/change-password-admission.service.js';
import { AuthLoginMetricsService } from '../login-attempts/auth-login-metrics.service.js';
import { AuthLoginThrottlerGuard } from '../login-attempts/auth-login-throttler.guard.js';
import { AuthLoginAttemptService } from '../login-attempts/auth-login-attempt.service.js';
import { ClearLoginFailuresCommand } from '../login-attempts/clear-login-failures.command.js';
import { GetActiveLoginLockQuery } from '../login-attempts/get-active-login-lock.query.js';
import { LoginAttemptRepository } from '../login-attempts/login-attempt.repository.js';
import { RecordLoginFailureCommand } from '../login-attempts/record-login-failure.command.js';
import { AuthRegistrationUseCases } from '../registration/auth-registration-use-cases.service.js';
import { SignupNicknameValidationAdmissionService } from '../registration/signup-nickname-validation-admission.service.js';
import { SignupNicknameValidationQuery } from '../registration/signup-nickname-validation.query.js';
import { SignupSubmissionAdmissionService } from '../registration/signup-submission-admission.service.js';
import { AuthSecurityEventRepository } from '../security-events/auth-security-event.repository.js';
import { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import { AuthSessionRepository } from '../sessions/auth-session.repository.js';
import { AuthSessionMetricsService } from '../sessions/auth-session-metrics.service.js';
import { AuthSessionUseCases } from '../sessions/auth-session-use-cases.service.js';
import { AuthSessionService } from '../sessions/auth-session.service.js';
import { CurrentSessionQuery } from '../sessions/current-session.query.js';
import { IssueSessionCommand } from '../sessions/issue-session.command.js';
import { LogoutSessionCommand } from '../sessions/logout-session.command.js';
import { RenewSessionCommand } from '../sessions/renew-session.command.js';
import { RevokeSessionsCommand } from '../sessions/revoke-sessions.command.js';
import { AuthVerificationEligibilityQuery } from '../verification/auth-verification-eligibility.query.js';
import { AuthVerificationUseCases } from '../verification/auth-verification-use-cases.service.js';
import { AuthVerificationService } from '../verification/auth-verification.service.js';
import { AuthVerificationStore } from '../verification/verification-code.repository.js';
import { AuthVerificationRequestRepository } from '../verification/auth-verification-request.repository.js';
import { AuthMailDispatcherService } from '../mail/auth-mail-dispatcher.service.js';
import { AuthMailEnvelopeReader } from '../mail/auth-mail-envelope-reader.service.js';
import { AuthMailEnvelopeWriter } from '../mail/auth-mail-envelope-writer.service.js';
import { AuthMailOutboxWriter } from '../mail/auth-mail-outbox-writer.service.js';
import { AuthMailOutboxRepository } from '../mail/auth-mail-outbox.repository.js';
import { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';

export const AUTH_APPLICATION_PROVIDERS: Provider[] = [AuthService, AuthActorContextResolver];

export const AUTH_OPERATIONAL_SIGNAL_PROVIDERS: Provider[] = [AuthFlowMetricsService];

export const AUTH_VERIFICATION_PROVIDERS: Provider[] = [
  AuthVerificationUseCases,
  AuthVerificationService,
  AuthVerificationEligibilityQuery,
  AuthVerificationStore,
  AuthVerificationRequestRepository,
];

export const AUTH_SESSION_PROVIDERS: Provider[] = [
  AuthSessionUseCases,
  AuthSessionService,
  AuthSessionMetricsService,
  AuthSessionRepository,
  CurrentSessionQuery,
  IssueSessionCommand,
  RenewSessionCommand,
  RevokeSessionsCommand,
  LogoutSessionCommand,
];

export const AUTH_CREDENTIAL_PROVIDERS: Provider[] = [
  AuthCredentialUseCases,
  AuthPasswordHashPolicy,
  ChangePasswordAdmissionService,
];

export const AUTH_REGISTRATION_PROVIDERS: Provider[] = [
  AuthRegistrationUseCases,
  SignupNicknameValidationAdmissionService,
  SignupNicknameValidationQuery,
  SignupSubmissionAdmissionService,
];

export const AUTH_LOGIN_ATTEMPT_PROVIDERS: Provider[] = [
  AuthLoginAttemptService,
  AuthLoginMetricsService,
  LoginAttemptRepository,
  GetActiveLoginLockQuery,
  RecordLoginFailureCommand,
  ClearLoginFailuresCommand,
];

export const AUTH_SECURITY_EVENT_PROVIDERS: Provider[] = [
  AuthSecurityEventService,
  AuthSecurityEventRepository,
];

export const AUTH_EMAIL_ADAPTER_PROVIDERS: Provider[] = [
  AuthMailEnvelopeWriter,
  AuthMailEnvelopeReader,
  AuthMailOutboxRepository,
  AuthMailOutboxWriter,
  AuthMailDispatcherService,
  StubEmailSenderService,
  SesEmailSenderService,
  {
    provide: EMAIL_SENDER_DELEGATE,
    inject: [emailConfig.KEY, StubEmailSenderService, SesEmailSenderService],
    useFactory: (
      settings: ConfigType<typeof emailConfig>,
      stub: StubEmailSenderService,
      ses: SesEmailSenderService,
    ): EmailSender => selectEmailSenderDelegate(settings, { stub, ses }),
  },
  MonitoredEmailSenderService,
  {
    provide: EMAIL_SENDER,
    useExisting: MonitoredEmailSenderService,
  },
];

export const AUTH_ACCESS_PROVIDERS: Provider[] = [
  AuthenticatedUserGuard,
  {
    provide: APP_GUARD,
    useClass: AuthLoginThrottlerGuard,
  },
  {
    provide: APP_GUARD,
    useClass: AuthenticatedUserGuard,
  },
];

export const AUTH_PROVIDERS: Provider[] = [
  ...AUTH_APPLICATION_PROVIDERS,
  ...AUTH_OPERATIONAL_SIGNAL_PROVIDERS,
  ...AUTH_VERIFICATION_PROVIDERS,
  ...AUTH_SESSION_PROVIDERS,
  ...AUTH_CREDENTIAL_PROVIDERS,
  ...AUTH_REGISTRATION_PROVIDERS,
  ...AUTH_LOGIN_ATTEMPT_PROVIDERS,
  ...AUTH_SECURITY_EVENT_PROVIDERS,
  ...AUTH_EMAIL_ADAPTER_PROVIDERS,
  ...AUTH_ACCESS_PROVIDERS,
];
