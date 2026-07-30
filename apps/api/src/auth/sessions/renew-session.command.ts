import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authConfig from '../../config/auth.config.js';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_SESSION_PREVIOUS_TOKEN_GRACE_MILLISECONDS,
  AUTH_SESSION_RENEWAL_STALE_RETRY_AFTER_MILLISECONDS,
} from '../domain/auth.constants.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import type { RenewSessionResult } from '../domain/auth.types.js';
import { authFailures } from '../errors/auth-failures.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../security-events/auth-security-event.types.js';
import { createOpaqueToken, hashOpaqueToken, parseOpaqueToken } from './opaque-token.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AuthSessionMetricsService } from './auth-session-metrics.service.js';
import { classifyRenewalToken, resolveRenewalRejectionReason } from './session-lifecycle.policy.js';

@Injectable()
export class RenewSessionCommand {
  constructor(
    private readonly repository: AuthSessionRepository,
    @Inject(authConfig.KEY)
    private readonly authSettings: ConfigType<typeof authConfig>,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
    @Optional() private readonly sessionMetrics?: AuthSessionMetricsService,
  ) {}

  async execute(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (!parsedRenewalToken) {
      this.sessionMetrics?.recordRenewal('required');
      await this.recordOpaqueTransportRejected('renewal', 'malformed_or_legacy', requestContext);
      return authFailures.sessionRenewalRequired();
    }

    const databaseNow = await this.repository.getDatabaseNow();
    const nextAccessToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextAccessTokenHash = hashOpaqueToken(nextAccessToken);
    const nextAccessTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const previousRefreshTokenValidUntil = new Date(
      databaseNow.getTime() + AUTH_SESSION_PREVIOUS_TOKEN_GRACE_MILLISECONDS,
    );
    const nextRenewalToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextRenewalTokenHash = hashOpaqueToken(nextRenewalToken);

    const renewalAttempt = await this.repository.runSerializableTransaction(async (tx) => {
      const session = await this.repository.findRenewalSessionById(
        tx,
        parsedRenewalToken.sessionId,
      );
      const rejectedReason = resolveRenewalRejectionReason(session, databaseNow);
      if (rejectedReason) {
        return null;
      }

      const currentRefreshTokenHash = session?.refreshTokenHash;
      if (!session || !currentRefreshTokenHash) {
        return null;
      }

      const tokenClassification = classifyRenewalToken(
        session,
        parsedRenewalToken.tokenHash,
        databaseNow,
        this.authSettings.renewalPreviousTokenGraceEnabled,
      );

      if (tokenClassification === 'previous') {
        return { kind: 'stale' as const };
      }

      if (tokenClassification === 'unknown') {
        await this.repository.revokeSessionById(tx, session.id, databaseNow);
        return { kind: 'reused' as const };
      }

      const rotation = await this.repository.rotateRenewalToken(tx, {
        sessionId: session.id,
        currentRefreshTokenHash,
        nextRenewalTokenHash,
        nextAccessTokenHash,
        nextAccessTokenExpiresAt,
        previousRefreshTokenValidUntil,
        rememberMe: session.rememberMe,
        databaseNow,
      });

      if (rotation.count !== 1) {
        return null;
      }

      return {
        kind: 'renewed' as const,
        rememberMe: session.rememberMe,
      };
    });

    if (!renewalAttempt) {
      this.sessionMetrics?.recordRenewal('required');
      return authFailures.sessionRenewalRequired();
    }

    if (renewalAttempt.kind === 'reused') {
      this.sessionMetrics?.recordRenewal('reused');
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'SESSION_TOKEN_REUSE_DETECTED',
        severity: 'WARNING',
        sessionId: parsedRenewalToken.sessionId,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          metricName: AUTH_SECURITY_EVENT_METRICS.tokenReuse,
          tokenKind: 'renewal',
        },
      });
      return authFailures.sessionRenewalReused();
    }

    if (renewalAttempt.kind === 'stale') {
      this.sessionMetrics?.recordRenewal('stale');
      return authFailures.sessionRenewalStale(AUTH_SESSION_RENEWAL_STALE_RETRY_AFTER_MILLISECONDS);
    }

    this.sessionMetrics?.recordRenewal('renewed');
    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'SESSION_REFRESH_SUCCESS',
      severity: 'INFO',
      sessionId: parsedRenewalToken.sessionId,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        rememberMe: renewalAttempt.rememberMe,
      },
    });

    return {
      success: true,
      accessToken: nextAccessToken,
      renewalToken: nextRenewalToken,
      rememberMe: renewalAttempt.rememberMe,
    };
  }

  private async recordOpaqueTransportRejected(
    tokenKind: 'access' | 'renewal',
    reason: string,
    requestContext: AuthRequestContext,
    context: { sessionId?: string; targetUserId?: string } = {},
  ) {
    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'OPAQUE_TRANSPORT_REJECTED',
      severity: 'WARNING',
      targetUserId: context.targetUserId,
      sessionId: context.sessionId,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        tokenKind,
        reason,
      },
    });
  }
}
