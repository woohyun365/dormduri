import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authConfig from '../config/auth.config.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  EMAIL_SENDER,
  type EmailSendReceipt,
  type EmailSender,
} from '../adapters/email/email-sender.interface.js';
import { isEmailProviderCategorizedError } from '../adapters/email/ses-email-error.js';
import { AuthMailEnvelopeReader } from './auth-mail-envelope-reader.service.js';
import type { AuthMailEnvelope } from './auth-mail-envelope.types.js';
import {
  AuthMailOutboxRepository,
  type ClaimedAuthMailOutboxEvent,
} from './auth-mail-outbox.repository.js';
import { AuthMailMetricsService } from './auth-mail-metrics.service.js';

export type AuthMailDispatchResult = {
  claimedCount: number;
  acceptedCount: number;
  failedCount: number;
  unknownCount: number;
  supersededCount: number;
};

@Injectable()
export class AuthMailDispatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AuthMailDispatcherService.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly envelopeReader: AuthMailEnvelopeReader,
    private readonly repository: AuthMailOutboxRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @Inject(authConfig.KEY)
    private readonly settings: ConfigType<typeof authConfig>,
    private readonly metrics?: AuthMailMetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.settings.mailDispatcherEnabled) {
      return;
    }
    this.interval = setInterval(() => {
      void this.dispatchOnce().catch((error) => {
        this.logger.warn(
          `[AuthMailDispatcher] dispatch tick failed errorType=${toErrorType(error)}`,
        );
      });
    }, this.settings.mailDispatcherIntervalMs);
    this.interval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async dispatchOnce(now?: Date): Promise<AuthMailDispatchResult> {
    if (this.running) {
      return emptyResult();
    }
    this.running = true;
    try {
      const databaseNow = now ?? (await this.prisma.getDatabaseNow());
      await this.repository.expirePayloads(this.prisma, databaseNow);
      const claimed = await this.repository.claimBatch(this.prisma, {
        limit: this.settings.mailDispatcherBatchSize,
        now: databaseNow,
        claimLeaseMs: this.settings.mailDispatcherClaimLeaseMs,
      });
      this.metrics?.recordOutboxLag(oldestClaimedLagSeconds(claimed, databaseNow));
      const result = emptyResult();
      result.claimedCount = claimed.length;

      for (const event of claimed) {
        await this.dispatchClaimed(event, databaseNow, result);
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async dispatchClaimed(
    event: ClaimedAuthMailOutboxEvent,
    now: Date,
    result: AuthMailDispatchResult,
  ): Promise<void> {
    if (
      !event.payloadCiphertext ||
      !event.payloadIv ||
      !event.payloadAuthTag ||
      event.expiresAt <= now
    ) {
      await this.repository.markSuperseded(this.prisma, { eventId: event.id, now });
      result.supersededCount += 1;
      this.recordDispatchMetric('superseded');
      return;
    }

    let payload: AuthMailEnvelope;
    try {
      payload = this.envelopeReader.decrypt({
        payloadCiphertext: event.payloadCiphertext,
        payloadIv: event.payloadIv,
        payloadAuthTag: event.payloadAuthTag,
        keyVersion: event.keyVersion,
      });
      if (payload.mailKind !== event.mailKind) {
        throw new Error('[AuthMailDispatcher] envelope mail kind mismatch');
      }
    } catch (error) {
      await this.repository.markDeliveryFailure(this.prisma, {
        eventId: event.id,
        now,
        status: 'FAILED',
        providerErrorCategory: 'PAYLOAD_INVALID',
      });
      result.failedCount += 1;
      this.recordDispatchMetric('failed');
      this.logger.warn(
        `[AuthMailDispatcher] invalid envelope eventId=${event.id} errorType=${toErrorType(error)}`,
      );
      return;
    }

    try {
      const receipt = await withTimeout(
        this.sendPayload(event.id, payload),
        this.settings.mailSendTimeoutMs,
      );
      const accepted = await this.repository.markAccepted(this.prisma, {
        eventId: event.id,
        now,
        providerMessageId: receipt.providerMessageId,
      });
      if (accepted) {
        result.acceptedCount += 1;
        this.recordDispatchMetric('accepted');
      } else {
        result.supersededCount += 1;
        this.recordDispatchMetric('superseded');
      }
    } catch (error) {
      const status = isAmbiguousDelivery(error) ? 'UNKNOWN' : 'FAILED';
      await this.repository.markDeliveryFailure(this.prisma, {
        eventId: event.id,
        now,
        status,
        providerErrorCategory: providerErrorCategory(error),
      });
      if (status === 'UNKNOWN') {
        result.unknownCount += 1;
        this.recordDispatchMetric('unknown');
      } else {
        result.failedCount += 1;
        this.recordDispatchMetric('failed');
      }
      this.logger.warn(
        `[AuthMailDispatcher] provider send failed eventId=${event.id} outcome=${status} errorType=${toErrorType(error)}`,
      );
    }
  }

  private sendPayload(eventId: string, payload: AuthMailEnvelope): Promise<EmailSendReceipt> {
    switch (payload.mailKind) {
      case 'SIGNUP_VERIFICATION':
        return this.emailSender.sendVerificationCode({
          email: payload.email,
          code: payload.code,
          expiresInSeconds: payload.expiresInSeconds,
          correlationId: eventId,
        });
      case 'PASSWORD_RESET_VERIFICATION':
        return this.emailSender.sendPasswordResetCode({
          email: payload.email,
          code: payload.code,
          expiresInSeconds: payload.expiresInSeconds,
          correlationId: eventId,
        });
      case 'PASSWORD_CHANGED':
        return this.emailSender.sendPasswordChanged({
          email: payload.email,
          correlationId: eventId,
        });
    }
  }

  private recordDispatchMetric(outcome: 'accepted' | 'failed' | 'unknown' | 'superseded') {
    this.metrics?.recordDispatch(outcome);
  }
}

function oldestClaimedLagSeconds(events: readonly ClaimedAuthMailOutboxEvent[], now: Date) {
  if (events.length === 0) {
    return 0;
  }

  const oldestCreatedAt = Math.min(...events.map((event) => event.createdAt.getTime()));
  return Math.max(0, (now.getTime() - oldestCreatedAt) / 1_000);
}

class AuthMailProviderTimeoutError extends Error {
  constructor() {
    super('[AuthMailDispatcher] provider acceptance timeout');
    this.name = 'AuthMailProviderTimeoutError';
  }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new AuthMailProviderTimeoutError()), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isAmbiguousDelivery(error: unknown): boolean {
  if (error instanceof AuthMailProviderTimeoutError) {
    return true;
  }
  if (!isEmailProviderCategorizedError(error)) {
    return true;
  }
  return error.providerErrorCategory === 'TRANSIENT' || error.providerErrorCategory === 'UNKNOWN';
}

function providerErrorCategory(error: unknown): string {
  if (error instanceof AuthMailProviderTimeoutError) {
    return 'TIMEOUT';
  }
  if (isEmailProviderCategorizedError(error)) {
    return error.providerErrorCategory;
  }
  return 'UNKNOWN';
}

function emptyResult(): AuthMailDispatchResult {
  return {
    claimedCount: 0,
    acceptedCount: 0,
    failedCount: 0,
    unknownCount: 0,
    supersededCount: 0,
  };
}

function toErrorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
