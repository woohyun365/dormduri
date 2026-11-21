import { Module } from '@nestjs/common';
import { AccessRolesModule } from '../access-control/roles/access-roles.module.js';
import { RoleAssignmentStore } from '../access-control/roles/role-assignment.store.js';
import { AdminAuditWriter } from '../audit/admin-audit-writer.js';
import { AuditModule } from '../audit/audit.module.js';
import {
  BACKOFFICE_SETTINGS,
  type BackofficeSettings,
} from '../platform/config/backoffice-settings.js';
import { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { BackofficeMetrics } from '../platform/observability/backoffice-metrics.js';
import { Clock } from '../platform/time/clock.js';
import { AccountsController } from './accounts/accounts.controller.js';
import { AdminAccountsService } from './accounts/admin-accounts.service.js';
import { CredentialIssuer } from './credential-issuer.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { SecretBox } from './crypto/secret-box.js';
import { AdminLoginService } from './login/admin-login.service.js';
import { LoginController } from './login/login.controller.js';
import {
  LOGIN_ATTEMPTS_PER_MINUTE,
  LoginRateLimiter,
  LoginRateLimitGuard,
} from './login/login-rate-limit.js';
import { AdminRegistrationService } from './registration/admin-registration.service.js';
import { RegistrationController } from './registration/registration.controller.js';
import { AdminSelfService } from './self-service/admin-self-service.js';
import { SelfServiceController } from './self-service/self-service.controller.js';
import { AdminSessionService } from './session/admin-session.service.js';
import { WebAuthnService } from './webauthn/webauthn.service.js';

/** Accounts, passwords, passkeys, TOTP, recovery codes, sessions and invitations (README §2). */
@Module({
  imports: [AuditModule, AccessRolesModule],
  controllers: [LoginController, RegistrationController, SelfServiceController, AccountsController],
  providers: [
    {
      provide: SecretBox,
      useFactory: (settings: BackofficeSettings) => new SecretBox(settings.totpEncryptionKey),
      inject: [BACKOFFICE_SETTINGS],
    },
    { provide: PasswordHasher, useValue: new PasswordHasher() },
    { provide: WebAuthnService, useValue: new WebAuthnService() },
    {
      // The window follows the application clock so tests can move past it.
      provide: LoginRateLimiter,
      useFactory: (clock: Clock) =>
        new LoginRateLimiter(LOGIN_ATTEMPTS_PER_MINUTE, () => clock.now().getTime()),
      inject: [Clock],
    },
    LoginRateLimitGuard,
    {
      provide: CredentialIssuer,
      useFactory: (secretBox: SecretBox) => new CredentialIssuer(secretBox),
      inject: [SecretBox],
    },
    {
      provide: AdminSessionService,
      useFactory: (prisma: BackofficeRuntimePrisma, audit: AdminAuditWriter, clock: Clock) =>
        new AdminSessionService(prisma, audit, clock),
      inject: [BackofficeRuntimePrisma, AdminAuditWriter, Clock],
    },
    {
      provide: AdminLoginService,
      useFactory: (
        prisma: BackofficeRuntimePrisma,
        audit: AdminAuditWriter,
        sessions: AdminSessionService,
        webauthn: WebAuthnService,
        passwords: PasswordHasher,
        secretBox: SecretBox,
        metrics: BackofficeMetrics,
        clock: Clock,
      ) =>
        new AdminLoginService(
          prisma,
          audit,
          sessions,
          webauthn,
          passwords,
          secretBox,
          metrics,
          clock,
        ),
      inject: [
        BackofficeRuntimePrisma,
        AdminAuditWriter,
        AdminSessionService,
        WebAuthnService,
        PasswordHasher,
        SecretBox,
        BackofficeMetrics,
        Clock,
      ],
    },
    {
      provide: AdminRegistrationService,
      useFactory: (
        prisma: BackofficeRuntimePrisma,
        audit: AdminAuditWriter,
        sessions: AdminSessionService,
        webauthn: WebAuthnService,
        passwords: PasswordHasher,
        credentials: CredentialIssuer,
        roles: RoleAssignmentStore,
        metrics: BackofficeMetrics,
        clock: Clock,
      ) =>
        new AdminRegistrationService(
          prisma,
          audit,
          sessions,
          webauthn,
          passwords,
          credentials,
          roles,
          metrics,
          clock,
        ),
      inject: [
        BackofficeRuntimePrisma,
        AdminAuditWriter,
        AdminSessionService,
        WebAuthnService,
        PasswordHasher,
        CredentialIssuer,
        RoleAssignmentStore,
        BackofficeMetrics,
        Clock,
      ],
    },
    {
      provide: AdminSelfService,
      useFactory: (
        prisma: BackofficeRuntimePrisma,
        audit: AdminAuditWriter,
        sessions: AdminSessionService,
        webauthn: WebAuthnService,
        secretBox: SecretBox,
        credentials: CredentialIssuer,
        clock: Clock,
      ) => new AdminSelfService(prisma, audit, sessions, webauthn, secretBox, credentials, clock),
      inject: [
        BackofficeRuntimePrisma,
        AdminAuditWriter,
        AdminSessionService,
        WebAuthnService,
        SecretBox,
        CredentialIssuer,
        Clock,
      ],
    },
    {
      provide: AdminAccountsService,
      useFactory: (
        prisma: BackofficeRuntimePrisma,
        audit: AdminAuditWriter,
        sessions: AdminSessionService,
        roles: RoleAssignmentStore,
        metrics: BackofficeMetrics,
        clock: Clock,
      ) => new AdminAccountsService(prisma, audit, sessions, roles, metrics, clock),
      inject: [
        BackofficeRuntimePrisma,
        AdminAuditWriter,
        AdminSessionService,
        RoleAssignmentStore,
        BackofficeMetrics,
        Clock,
      ],
    },
  ],
  exports: [AdminSessionService],
})
export class AdminIdentityModule {}
