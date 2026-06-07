import type { DisplayIdentityEditUnavailableReason } from '@repo/shared/display-identity-contract';
import type { Campus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../seasons/ports/season-context.port.js';
import type { SeasonState } from '@repo/shared/season/runtime';
import { isParticipantRegistered } from '../season-participants/policies/index.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
} from '../season-participants/participants/season-participant-records.js';

export interface NicknameChangePolicyUser {
  id: string;
  campus: Campus;
}

export interface NicknameChangePolicyDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
}

type NicknameChangePolicyReader =
  | Pick<PrismaService, 'seasonParticipant'>
  | Pick<Prisma.TransactionClient, 'seasonParticipant'>;

export interface NicknameChangePolicyResult {
  nicknameLockedBySeason: boolean;
  currentRegisteredParticipant: CurrentSeasonParticipantRecord | null;
}

const NICKNAME_LOCK_SEASON_STATES = new Set<SeasonState>([
  'SEASON_OPEN',
  'SEASON_MATCHING',
  'SEASON_POST_MATCH',
]);

export function isNicknameLockedByCurrentSeasonRegistration(input: {
  seasonState: SeasonState | null;
  participantRegistered: boolean;
}) {
  return Boolean(
    input.participantRegistered &&
    input.seasonState &&
    NICKNAME_LOCK_SEASON_STATES.has(input.seasonState),
  );
}

export function buildDisplayIdentityEditUnavailableReasons(input: {
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
}): DisplayIdentityEditUnavailableReason[] {
  const reasons: DisplayIdentityEditUnavailableReason[] = [];
  if (input.nicknameLockedBySeason) {
    reasons.push('CURRENT_SEASON_REGISTRATION_LOCK');
  }
  if (input.nicknameCooldownActive) {
    reasons.push('NICKNAME_COOLDOWN_ACTIVE');
  }
  return reasons;
}

export async function resolveNicknameChangePolicy(
  deps: NicknameChangePolicyDeps,
  user: NicknameChangePolicyUser,
  now: Date,
  client: NicknameChangePolicyReader = deps.prisma,
): Promise<NicknameChangePolicyResult> {
  const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
  if (!seasonContext || !NICKNAME_LOCK_SEASON_STATES.has(seasonContext.state)) {
    return {
      nicknameLockedBySeason: false,
      currentRegisteredParticipant: null,
    };
  }

  const currentParticipant = await client.seasonParticipant.findUnique({
    where: {
      seasonId_userId: {
        seasonId: seasonContext.season.id,
        userId: user.id,
      },
    },
    select: currentSeasonParticipantSelect,
  });
  const participant = currentParticipant
    ? mapCurrentSeasonParticipantRecord(currentParticipant)
    : null;
  const participantRegistered = isParticipantRegistered(participant);

  return {
    nicknameLockedBySeason: isNicknameLockedByCurrentSeasonRegistration({
      seasonState: seasonContext.state,
      participantRegistered,
    }),
    currentRegisteredParticipant: participantRegistered ? participant : null,
  };
}
