import type { SelectableDormitory } from '@repo/shared/season-contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CurrentSeasonContext } from '../../seasons/season.types.js';
import { assertUserAccountIdentity } from '../../identity/account-identity-invariant.js';
import { usersErrors } from '../../users/users.errors.js';
import type { DormitorySelectionReadinessEvaluator } from '../dormitory-selection/dormitory-selection-readiness.evaluator.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import type { VerifiedSeasonActionUser } from '../application/season-action-user.query.js';
import { assertSeasonProfileCompleteForRegistration } from '../profile-draft/season-profile-completeness.policy.js';
import {
  assertParticipantAllowsRegistration,
  assertParticipantHasDormitorySelection,
} from './season-registration.policy.js';

export function createSeasonRegistrationReadinessEvaluator(
  dormitorySelectionReadiness: DormitorySelectionReadinessEvaluator,
) {
  async function assertReadyForRegistration(input: {
    tx: Prisma.TransactionClient;
    user: VerifiedSeasonActionUser;
    participant: CurrentSeasonParticipantRecord;
    seasonContext: CurrentSeasonContext;
    now: Date;
  }): Promise<{
    selectedDormitory: SelectableDormitory;
    displayIdentity: NonNullable<VerifiedSeasonActionUser['displayIdentity']>;
    academicIdentity: NonNullable<VerifiedSeasonActionUser['academicIdentity']>;
  }> {
    assertUserAccountIdentity(input.user, (invariant) =>
      usersErrors.accountIdentityIncomplete('registration-finalize', invariant),
    );
    assertParticipantAllowsRegistration(input.participant);
    assertSeasonProfileCompleteForRegistration(input.participant.profile);
    assertParticipantHasDormitorySelection(input.participant);

    const selectedDormitory = await dormitorySelectionReadiness.validateDormitorySelection(
      input.tx,
      input.participant,
      input.seasonContext,
      input.participant.dormitoryId!,
      input.now,
    );

    return {
      selectedDormitory,
      displayIdentity: input.user.displayIdentity,
      academicIdentity: input.user.academicIdentity,
    };
  }

  return { assertReadyForRegistration };
}

export type SeasonRegistrationReadinessEvaluator = ReturnType<
  typeof createSeasonRegistrationReadinessEvaluator
>;
