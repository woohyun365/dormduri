import { Injectable } from '@nestjs/common';
import type {
  SignupDraftValidationFieldErrors,
  SignupDraftValidationResponse,
} from '@repo/shared/auth-response';
import { validateKnuEmailFormat } from '@repo/shared/auth-policy';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ModerationService } from '../../moderation/moderation.service.js';
import {
  normalizeNickname,
  validateNicknameFormat,
  validatePasswordPolicy,
} from '../domain/auth.utils.js';
import { authFailures } from '../errors/auth-failures.js';

@Injectable()
export class AuthSignupValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
  ) {}

  async validateDraft(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupDraftValidationResponse> {
    const fieldErrors: SignupDraftValidationFieldErrors = {};

    const emailError = validateKnuEmailFormat(input.email);
    if (emailError) {
      fieldErrors.email = emailError;
    }

    const passwordError = validatePasswordPolicy(input.password, input.email);
    if (passwordError) {
      fieldErrors.password = passwordError;
    }

    const nicknameFormatError = validateNicknameFormat(input.nickname);
    if (nicknameFormatError) {
      fieldErrors.nickname = nicknameFormatError;
    } else {
      const nicknamePolicyError = await this.moderationService.validateNicknamePolicy(
        input.nickname,
      );
      if (nicknamePolicyError) {
        fieldErrors.nickname = nicknamePolicyError;
      } else {
        const existingNickname = await this.prisma.userDisplayIdentity.findUnique({
          where: { nicknameNormalized: normalizeNickname(input.nickname) },
          select: { userId: true },
        });
        if (existingNickname) {
          fieldErrors.nickname = '이미 사용 중인 닉네임입니다.';
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return authFailures.signupValidation('입력값을 다시 확인해주세요.', fieldErrors);
    }

    return { success: true };
  }
}
