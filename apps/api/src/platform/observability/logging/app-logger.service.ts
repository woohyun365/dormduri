import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import pino, { type Logger as PinoLogger } from 'pino';
import observabilityConfig from '../../../config/observability.config.js';
import { compactLogEvent, type AppLogEvent, type AppLogLevel } from './log-event.js';
import { redactLogValue } from './log-redaction.policy.js';
import { RequestContextService } from './request-context.service.js';

const nestLogLevelByMethod = {
  debug: 'debug',
  error: 'error',
  log: 'info',
  verbose: 'debug',
  warn: 'warn',
} as const;

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: PinoLogger;

  constructor(
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = pino({
      base: {
        env: settings.env,
        service: settings.serviceName,
      },
      formatters: {
        level: (label) => ({ level: label }),
      },
      level: settings.logLevel,
      timestamp: () => `,"ts":"${new Date().toISOString()}"`,
    });
  }

  write(level: AppLogLevel, event: AppLogEvent, message = 'api event'): void {
    try {
      const context = this.requestContext.getStore();
      const redactedEvent = redactLogValue(
        compactLogEvent({
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          actorHash: context?.actorHash,
          ...event,
        }),
      ) as Record<string, unknown>;
      const redactedMessage = redactLogValue(message) as string;

      this.writeToPino(level, redactedEvent, redactedMessage);
    } catch {
      // Logging must never affect product request handling.
    }
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNestLog(nestLogLevelByMethod.log, message, optionalParams, false);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNestLog(nestLogLevelByMethod.error, message, optionalParams, true);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNestLog(nestLogLevelByMethod.warn, message, optionalParams, false);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNestLog(nestLogLevelByMethod.debug, message, optionalParams, false);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNestLog(nestLogLevelByMethod.verbose, message, optionalParams, false);
  }

  private writeNestLog(
    level: AppLogLevel,
    message: unknown,
    optionalParams: unknown[],
    firstOptionalParamIsTrace: boolean,
  ): void {
    const contextCandidates = firstOptionalParamIsTrace ? optionalParams.slice(1) : optionalParams;
    const context = contextCandidates.findLast(
      (param): param is string => typeof param === 'string',
    );
    const event: AppLogEvent = {
      context,
      errorName: message instanceof Error ? message.name : undefined,
      outcome: level === 'error' ? 'failure' : undefined,
    };
    const resolvedMessage = this.resolveMessage(message);

    this.write(level, event, resolvedMessage);
  }

  private resolveMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.name;
    }

    if (message && typeof message === 'object') {
      return 'structured log event';
    }

    return String(message);
  }

  private writeToPino(level: AppLogLevel, event: Record<string, unknown>, message: string): void {
    switch (level) {
      case 'debug':
        this.logger.debug(event, message);
        return;
      case 'warn':
        this.logger.warn(event, message);
        return;
      case 'error':
        this.logger.error(event, message);
        return;
      case 'info':
      default:
        this.logger.info(event, message);
    }
  }
}
