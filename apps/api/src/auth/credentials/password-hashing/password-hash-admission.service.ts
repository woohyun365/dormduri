import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { performance } from 'node:perf_hooks';
import authConfig, {
  DEFAULT_AUTH_PASSWORD_HASH_CONCURRENCY,
  DEFAULT_AUTH_PASSWORD_HASH_QUEUE_LIMIT,
  DEFAULT_AUTH_PASSWORD_HASH_WAIT_TIMEOUT_MS,
} from '../../../config/auth.config.js';
import { AuthFlowMetricsService } from '../../operations/auth-flow-metrics.service.js';

export type AuthPasswordHashOperation =
  | 'account_deletion_verify'
  | 'change_hash'
  | 'change_verify'
  | 'login_dummy'
  | 'login_verify'
  | 'reset_hash'
  | 'reset_verify'
  | 'signup_hash'
  | 'support';

export type AuthPasswordHashTarget = 'hash' | 'verify';

interface PasswordHashAdmissionSettings {
  readonly concurrency: number;
  readonly queueLimit: number;
  readonly waitTimeoutMs: number;
}

interface WaitingOperation {
  readonly operation: AuthPasswordHashOperation;
  readonly resolve: () => void;
  readonly reject: (error: PasswordHashCapacityUnavailableError) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export class PasswordHashCapacityUnavailableError extends ServiceUnavailableException {
  readonly code = 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE';

  constructor(readonly retryAfterSeconds: number) {
    super({
      success: false,
      code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
      error: '비밀번호 처리가 잠시 지연되고 있어요.',
      retryAfterSeconds,
    });
    this.name = 'PasswordHashCapacityUnavailableError';
  }
}

export function isPasswordHashCapacityUnavailableError(
  error: unknown,
): error is PasswordHashCapacityUnavailableError {
  return error instanceof PasswordHashCapacityUnavailableError;
}

class ProcessPasswordHashAdmission {
  private settings: PasswordHashAdmissionSettings = {
    concurrency: DEFAULT_AUTH_PASSWORD_HASH_CONCURRENCY,
    queueLimit: DEFAULT_AUTH_PASSWORD_HASH_QUEUE_LIMIT,
    waitTimeoutMs: DEFAULT_AUTH_PASSWORD_HASH_WAIT_TIMEOUT_MS,
  };
  private inFlight = 0;
  private readonly inFlightByOperation = new Map<AuthPasswordHashOperation, number>();
  private readonly queue: WaitingOperation[] = [];
  private metrics?: Pick<
    AuthFlowMetricsService,
    'recordPasswordHashAdmission' | 'recordPasswordHashInFlight' | 'recordPasswordHashOperation'
  >;

  configure(
    settings: PasswordHashAdmissionSettings,
    metrics?: Pick<
      AuthFlowMetricsService,
      'recordPasswordHashAdmission' | 'recordPasswordHashInFlight' | 'recordPasswordHashOperation'
    >,
  ): void {
    this.settings = {
      concurrency: Math.max(1, Math.floor(settings.concurrency)),
      queueLimit: Math.max(0, Math.floor(settings.queueLimit)),
      waitTimeoutMs: Math.max(1, Math.floor(settings.waitTimeoutMs)),
    };
    this.metrics = metrics;
  }

  async run<T>(
    operation: AuthPasswordHashOperation,
    target: AuthPasswordHashTarget,
    task: () => Promise<T>,
  ): Promise<T> {
    await this.acquire(operation);
    const startedAt = performance.now();
    try {
      const result = await task();
      this.metrics?.recordPasswordHashOperation(
        operation,
        target,
        (performance.now() - startedAt) / 1_000,
      );
      return result;
    } catch (error) {
      this.metrics?.recordPasswordHashOperation(
        operation,
        target,
        (performance.now() - startedAt) / 1_000,
      );
      throw error;
    } finally {
      this.release(operation);
    }
  }

  private async acquire(operation: AuthPasswordHashOperation): Promise<void> {
    if (this.inFlight < this.settings.concurrency) {
      this.begin(operation);
      this.metrics?.recordPasswordHashAdmission(operation, 'admitted');
      return;
    }

    if (this.queue.length >= this.settings.queueLimit) {
      this.metrics?.recordPasswordHashAdmission(operation, 'queue_full');
      throw this.capacityError();
    }

    this.metrics?.recordPasswordHashAdmission(operation, 'queued');
    await new Promise<void>((resolve, reject) => {
      const waiting: WaitingOperation = {
        operation,
        resolve,
        reject,
        timeout: setTimeout(() => {
          const index = this.queue.indexOf(waiting);
          if (index >= 0) {
            this.queue.splice(index, 1);
          }
          this.metrics?.recordPasswordHashAdmission(operation, 'timed_out');
          reject(this.capacityError());
        }, this.settings.waitTimeoutMs),
      };
      this.queue.push(waiting);
    });
  }

  private begin(operation: AuthPasswordHashOperation): void {
    this.inFlight += 1;
    const operationInFlight = (this.inFlightByOperation.get(operation) ?? 0) + 1;
    this.inFlightByOperation.set(operation, operationInFlight);
    this.metrics?.recordPasswordHashInFlight(operation, operationInFlight);
  }

  private release(operation: AuthPasswordHashOperation): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const operationInFlight = Math.max(0, (this.inFlightByOperation.get(operation) ?? 0) - 1);
    this.inFlightByOperation.set(operation, operationInFlight);
    this.metrics?.recordPasswordHashInFlight(operation, operationInFlight);

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    clearTimeout(next.timeout);
    this.begin(next.operation);
    this.metrics?.recordPasswordHashAdmission(next.operation, 'admitted');
    next.resolve();
  }

  private capacityError(): PasswordHashCapacityUnavailableError {
    return new PasswordHashCapacityUnavailableError(
      Math.max(1, Math.ceil(this.settings.waitTimeoutMs / 1_000)),
    );
  }
}

const processPasswordHashAdmission = new ProcessPasswordHashAdmission();

export async function runPasswordHashOperation<T>(
  operation: AuthPasswordHashOperation,
  target: AuthPasswordHashTarget,
  task: () => Promise<T>,
): Promise<T> {
  return processPasswordHashAdmission.run(operation, target, task);
}

@Injectable()
export class PasswordHashAdmissionService {
  constructor(
    @Inject(authConfig.KEY) settings: ConfigType<typeof authConfig>,
    @Optional() @Inject(AuthFlowMetricsService) flowMetrics?: AuthFlowMetricsService,
  ) {
    processPasswordHashAdmission.configure(
      {
        concurrency: settings.authPasswordHashConcurrency,
        queueLimit: settings.authPasswordHashQueueLimit,
        waitTimeoutMs: settings.authPasswordHashWaitTimeoutMs,
      },
      flowMetrics,
    );
  }
}
