import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';

const SIGNUP_NICKNAME_VALIDATION_LIMIT = 20;
const SIGNUP_NICKNAME_VALIDATION_WINDOW_MS = 60_000;
const SIGNUP_NICKNAME_VALIDATION_THROTTLER = 'signup-nickname-validation';

@Injectable()
export class SignupNicknameValidationAdmissionService {
  constructor(@InjectThrottlerStorage() private readonly storage: ThrottlerStorage) {}

  async consume(grantTokenHash: string): Promise<number | null> {
    const fingerprint = createHash('sha256').update(grantTokenHash).digest('hex');
    const result = await this.storage.increment(
      `auth:signup:nickname:${fingerprint}`,
      SIGNUP_NICKNAME_VALIDATION_WINDOW_MS,
      SIGNUP_NICKNAME_VALIDATION_LIMIT,
      SIGNUP_NICKNAME_VALIDATION_WINDOW_MS,
      SIGNUP_NICKNAME_VALIDATION_THROTTLER,
    );

    return result.isBlocked ? Math.max(1, result.timeToBlockExpire) : null;
  }
}
