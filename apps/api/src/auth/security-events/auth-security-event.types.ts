import type { Prisma } from '../../generated/prisma/client.js';

export type AuthSecurityEventType = Prisma.AuthSecurityEventCreateInput['type'];
export type AuthSecurityEventSeverity = Prisma.AuthSecurityEventCreateInput['severity'];

export interface AuthSecurityEventInput {
  type: AuthSecurityEventType;
  severity?: AuthSecurityEventSeverity;
  actorUserId?: string | null;
  targetUserId?: string | null;
  sessionId?: string | null;
  emailNormalized?: string | null;
  requestIp?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const AUTH_SECURITY_EVENT_METRICS = {
  mailSendSuccess: 'auth.mail.send.success',
  mailSendFailure: 'auth.mail.send.failure',
  loginFailure: 'auth.login.failure',
  loginLockout: 'auth.login.lockout',
  resetRequest: 'auth.reset.request',
  tokenReuse: 'auth.session.token_reuse',
} as const;
