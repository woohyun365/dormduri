import { Injectable } from '@nestjs/common';
import type { SignupProfileValidationResponse } from '@repo/shared/auth-response';
import { validateKnuEmailFormat } from '@repo/shared/auth-policy';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { normalizeNickname, validateNicknameFormat, validatePasswordPolicy } from './auth.utils.js';

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
  }): Promise<SignupProfileValidationResponse> {
    const errors: NonNullable<SignupProfileValidationResponse['errors']> = {};

    const emailError = validateKnuEmailFormat(input.email);
    if (emailError) {
      errors.email = emailError;
    }

    const passwordError = validatePasswordPolicy(input.password, input.email);
    if (passwordError) {
      errors.password = passwordError;
    }

    const nicknameFormatError = validateNicknameFormat(input.nickname);
    if (nicknameFormatError) {
      errors.nickname = nicknameFormatError;
    } else {
      const nicknamePolicyError = await this.moderationService.validateNicknamePolicy(
        input.nickname,
      );
      if (nicknamePolicyError) {
        errors.nickname = nicknamePolicyError;
      } else {
        const existingNickname = await this.prisma.user.findUnique({
          where: { nicknameNormalized: normalizeNickname(input.nickname) },
          select: { id: true },
        });
        if (existingNickname) {
          errors.nickname = '이미 사용 중인 닉네임입니다.';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        error: '입력값을 다시 확인해주세요.',
        errors,
      };
    }

    return { success: true };
  }
}
