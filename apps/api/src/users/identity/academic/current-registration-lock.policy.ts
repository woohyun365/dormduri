import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../../seasons/ports/season-context.port.js';
import type {
  NicknameChangePolicyResult,
  NicknameChangePolicyUser,
} from '../display/display-identity-edit.policy.js';
import { resolveNicknameChangePolicy } from '../display/display-identity-edit.policy.js';

export interface CurrentRegistrationLockPolicyDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
}

type CurrentRegistrationLockPolicyReader =
  Pick<PrismaService, 'seasonParticipant'> | Pick<Prisma.TransactionClient, 'seasonParticipant'>;

export async function resolveCurrentRegistrationLockPolicy(
  deps: CurrentRegistrationLockPolicyDeps,
  user: NicknameChangePolicyUser,
  now: Date,
  client: CurrentRegistrationLockPolicyReader = deps.prisma,
): Promise<NicknameChangePolicyResult> {
  return resolveNicknameChangePolicy(deps, user, now, client);
}
