import { Injectable } from '@nestjs/common';
import type { ParsedDisplayIdentityNickname as SharedParsedDisplayIdentityNickname } from '@repo/shared/user/identity/display';
import { parseDisplayIdentityNickname } from '@repo/shared/user/identity/display';
import { ModerationService } from '../../../moderation/moderation.service.js';
import {
  DisplayIdentityRepository,
  type UserDisplayIdentityClient,
} from './display-identity.repository.js';

export type ParsedDisplayIdentityNickname = Extract<
  SharedParsedDisplayIdentityNickname,
  { ok: true }
>;

export type DisplayIdentityNicknamePolicyRejection =
  'INVALID_FORMAT' | 'MODERATION_REJECTED' | 'ALREADY_TAKEN';

export class DisplayIdentityNicknamePolicyError extends Error {
  constructor(
    readonly reason: DisplayIdentityNicknamePolicyRejection,
    message: string,
  ) {
    super(message);
    this.name = 'DisplayIdentityNicknamePolicyError';
  }
}

@Injectable()
export class DisplayIdentityNicknamePolicyService {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly repository: DisplayIdentityRepository,
  ) {}

  parse(nickname: string): ParsedDisplayIdentityNickname {
    const parsed = parseDisplayIdentityNickname(nickname);
    if (!parsed.ok) {
      throw new DisplayIdentityNicknamePolicyError('INVALID_FORMAT', parsed.message);
    }

    return parsed;
  }

  async assertModerationAccepted(parsed: ParsedDisplayIdentityNickname): Promise<void> {
    const policyError = await this.moderationService.validateNicknamePolicy(parsed.value);
    if (policyError) {
      throw new DisplayIdentityNicknamePolicyError('MODERATION_REJECTED', policyError);
    }
  }

  async assertAvailable(
    parsed: ParsedDisplayIdentityNickname,
    options: {
      client?: UserDisplayIdentityClient;
      excludeUserId?: string;
    } = {},
  ): Promise<void> {
    const ownerId = await this.repository.findNicknameOwner(parsed.normalized, options.client);
    if (ownerId && ownerId !== options.excludeUserId) {
      throw new DisplayIdentityNicknamePolicyError('ALREADY_TAKEN', '이미 사용 중인 닉네임입니다.');
    }
  }

  async validate(
    nickname: string,
    options: {
      client?: UserDisplayIdentityClient;
      excludeUserId?: string;
    } = {},
  ): Promise<ParsedDisplayIdentityNickname> {
    const parsed = this.parse(nickname);
    await this.assertModerationAccepted(parsed);
    await this.assertAvailable(parsed, options);
    return parsed;
  }
}
