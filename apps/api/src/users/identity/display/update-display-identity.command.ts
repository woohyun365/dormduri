import type { UpdateCurrentUserDisplayIdentityMutationResult } from '@repo/shared/user';
import { parseDisplayIdentityNickname as parseSharedDisplayIdentityNickname } from '@repo/shared/user/identity/display';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ModerationService } from '../../../moderation/moderation.service.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../../seasons/ports/season-context.port.js';
import type { UserWithDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../errors/users.errors.js';
import { hasNicknameCooldown } from './nickname-cooldown.policy.js';
import { resolveNicknameChangePolicy } from './display-identity-edit.policy.js';
import {
  assertDisplayIdentity,
  assertNicknameAvailableForUser,
  isSameNickname,
  type ParsedDisplayIdentityNickname,
  updateDisplayIdentityNickname,
} from './display-identity.repository.js';
import { recordDisplayIdentityNicknameChangeAuditTx } from '../audit/display-identity-nickname-audit.repository.js';

export interface UpdateDisplayIdentityCommandDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  moderationService: ModerationService;
}

export function createUpdateDisplayIdentityCommand(deps: UpdateDisplayIdentityCommandDeps) {
  function parseDisplayIdentityNickname(nickname: string): ParsedDisplayIdentityNickname {
    const parsedNickname = parseSharedDisplayIdentityNickname(nickname);
    if (!parsedNickname.ok) {
      throw usersErrors.invalidNickname(parsedNickname.message);
    }

    return parsedNickname;
  }

  async function applySelfServiceNicknameChange(
    txUser: UserWithDisplayIdentityRecord,
    parsedNickname: ParsedDisplayIdentityNickname,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<UpdateCurrentUserDisplayIdentityMutationResult> {
    const displayIdentity = assertDisplayIdentity(txUser.displayIdentity);

    if (isSameNickname(displayIdentity, parsedNickname)) {
      return {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_NICKNAME',
      };
    }

    const nicknamePolicy = await resolveNicknameChangePolicy(
      {
        prisma: deps.prisma,
        seasonsService: deps.seasonsService,
      },
      txUser,
      now,
      tx,
    );
    if (nicknamePolicy.nicknameLockedBySeason) {
      throw usersErrors.nicknameLockedBySeason();
    }

    if (hasNicknameCooldown(displayIdentity.nicknameChangedAt, now)) {
      throw usersErrors.nicknameCooldownActive();
    }

    await assertNicknamePolicyAccepted(parsedNickname.value);
    await assertNicknameAvailableForUser(tx, parsedNickname, txUser.id);
    await updateDisplayIdentityNickname(tx, {
      userId: txUser.id,
      displayIdentity,
      parsedNickname,
      now,
    });
    await recordDisplayIdentityNicknameChangeAuditTx(tx, {
      userId: txUser.id,
      source: 'USER_SELF',
      reason: 'USER_REQUEST',
      actorType: 'USER',
      actorId: txUser.id,
      previousNickname: displayIdentity.nickname,
      previousNicknameNormalized: displayIdentity.nicknameNormalized,
      nextNickname: parsedNickname.value,
      nextNicknameNormalized: parsedNickname.normalized,
      changedAt: now,
    });

    return {
      attempted: true,
      changed: true,
      noOpReason: null,
    };
  }

  async function assertNicknamePolicyAccepted(nickname: string) {
    const nicknamePolicyError = await deps.moderationService.validateNicknamePolicy(nickname);
    if (nicknamePolicyError) {
      throw usersErrors.nicknameModerationRejected(nicknamePolicyError);
    }
  }

  return {
    parseDisplayIdentityNickname,
    applySelfServiceNicknameChange,
  };
}
