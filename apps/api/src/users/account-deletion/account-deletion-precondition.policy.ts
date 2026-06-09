import { badRequestError, conflictError } from '../../platform/http/api-error.js';
import { isParticipantRegistered } from '../../season-participants/policies/index.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import type { AccountDeletionParticipant } from './account-deletion.repository.js';

export type CurrentSeasonContext = NonNullable<
  Awaited<ReturnType<SeasonContextPort['getCurrentSeasonContext']>>
>;

interface AccountDeletionPrecheckUser {
  deletedAt: Date | null;
}

export function assertAccountDeletionUserExists<T extends AccountDeletionPrecheckUser>(
  user: T | null,
): asserts user is T {
  if (!user) {
    throw badRequestError('ACCOUNT_DELETION_USER_NOT_FOUND', '사용자 정보를 찾을 수 없습니다.');
  }
}

export function assertAccountIsNotDeleted(user: AccountDeletionPrecheckUser) {
  if (user.deletedAt) {
    throw conflictError('ACCOUNT_ALREADY_DELETED', '이미 삭제 처리된 계정입니다.');
  }
}

export function assertAccountDeletionPasswordMatches(passwordMatches: boolean) {
  if (!passwordMatches) {
    throw badRequestError('ACCOUNT_DELETION_PASSWORD_MISMATCH', '비밀번호가 일치하지 않습니다.');
  }
}

export function assertAccountDeletionAllowedForCurrentSeasonParticipant(
  participant: AccountDeletionParticipant | null,
  seasonContext: CurrentSeasonContext,
) {
  if (isParticipantRegistered(participant)) {
    throw accountDeletionBlockedBySeasonParticipation(seasonContext);
  }
}

export function accountDeletionBlockedBySeasonParticipation(seasonContext: CurrentSeasonContext) {
  return conflictError(
    'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
    '현재 시즌 참여 중에는 계정 삭제 요청을 받을 수 없습니다. 시즌 참여 철회를 먼저 진행하거나 시즌 종료 후 다시 시도해주세요.',
    {
      seasonState: seasonContext.state,
      seasonEndDate: seasonContext.schedule.seasonEnd,
    },
  );
}
