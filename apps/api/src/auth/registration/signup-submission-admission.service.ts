import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';

export const SIGNUP_SUBMISSION_LIMIT = 5;
export const SIGNUP_SUBMISSION_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_SUBMISSION_THROTTLER = 'signup-submission';

@Injectable()
export class SignupSubmissionAdmissionService {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    private readonly flowMetrics: AuthFlowMetricsService,
  ) {}

  async consume(grantTokenHash: string): Promise<number | null> {
    const fingerprint = createHash('sha256').update(grantTokenHash).digest('hex');
    const result = await this.storage.increment(
      `auth:signup:submission:${fingerprint}`,
      SIGNUP_SUBMISSION_WINDOW_MS,
      SIGNUP_SUBMISSION_LIMIT,
      SIGNUP_SUBMISSION_WINDOW_MS,
      SIGNUP_SUBMISSION_THROTTLER,
    );

    this.flowMetrics.recordSignupFinalAdmission(result.isBlocked ? 'throttled' : 'allowed');
    return result.isBlocked ? Math.max(1, result.timeToBlockExpire) : null;
  }
}
