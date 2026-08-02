import type { UpdateCurrentUserDisplayIdentityMutationResult } from '@repo/shared/user';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../../seasons/ports/season-context.port.js';
import type { UserWithDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../errors/users.errors.js';
import { hasNicknameCooldown } from './nickname-cooldown.policy.js';
import { resolveNicknameChangePolicy } from './display-identity-edit.policy.js';
import {
  assertDisplayIdentity,
  isSameNickname,
  updateDisplayIdentityNickname,
} from './display-identity.repository.js';
import { recordDisplayIdentityNicknameChangeAuditTx } from '../audit/display-identity-nickname-audit.repository.js';
import type {
  DisplayIdentityNicknamePolicyService,
  ParsedDisplayIdentityNickname,
} from './display-identity-nickname-policy.service.js';
import {
  applyDisplayIdentityNicknamePolicyForUser,
  parseDisplayIdentityNicknameForUser,
} from './display-identity-nickname-user-error.js';

export interface UpdateDisplayIdentityCommandDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  nicknamePolicy: DisplayIdentityNicknamePolicyService;
}

export function createUpdateDisplayIdentityCommand(deps: UpdateDisplayIdentityCommandDeps) {
  function parseDisplayIdentityNickname(nickname: string): ParsedDisplayIdentityNickname {
    return parseDisplayIdentityNicknameForUser(deps.nicknamePolicy, nickname);
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

    await applyDisplayIdentityNicknamePolicyForUser(async () => {
      await deps.nicknamePolicy.assertModerationAccepted(parsedNickname);
      await deps.nicknamePolicy.assertAvailable(parsedNickname, {
        client: tx,
        excludeUserId: txUser.id,
      });
    });
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

  return {
    parseDisplayIdentityNickname,
    applySelfServiceNicknameChange,
  };
}
