import type {
  UpdateSeasonOverrideRequest,
  UpdateSeasonScheduleRequest,
} from '@repo/shared/season/operations';
import { seasonsErrors } from '../seasons.errors.js';

export function assertValidSeasonSchedule(input: UpdateSeasonScheduleRequest) {
  if (input.preparationStartDate > input.matchingStartDate) {
    throw seasonsErrors.invalidOperationRequest(
      'SEASONS_OPERATION_INVALID_SCHEDULE',
      '시즌 준비 시작일은 매칭 시작일보다 늦을 수 없습니다.',
    );
  }

  if (input.matchingStartDate > input.seasonEndDate) {
    throw seasonsErrors.invalidOperationRequest(
      'SEASONS_OPERATION_INVALID_SCHEDULE',
      '시즌 매칭 시작일은 시즌 종료일보다 늦을 수 없습니다.',
    );
  }
}

export function assertValidSeasonOverride(input: UpdateSeasonOverrideRequest) {
  if (input.startsAt && input.endsAt && new Date(input.startsAt) > new Date(input.endsAt)) {
    throw seasonsErrors.invalidOperationRequest(
      'SEASONS_OPERATION_INVALID_OVERRIDE_WINDOW',
      '시즌 override 시작 시각은 종료 시각보다 늦을 수 없습니다.',
    );
  }
}
