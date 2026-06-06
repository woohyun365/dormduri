import { Injectable } from '@nestjs/common';
import type { UpdateSeasonScheduleRequest } from '@repo/shared/season-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { SeasonOperationAuditAction } from '../../generated/prisma/enums.js';
import { seasonsErrors } from '../seasons.errors.js';
import { assertValidSeasonSchedule } from './season-operations.policy.js';
import { SeasonOperationsAuditRepository } from './season-operations-audit.repository.js';
import { toSeasonOperationResponse } from './season-operations.mapper.js';
import { SeasonOperationsRepository } from './season-operations.repository.js';

@Injectable()
export class UpdateSeasonScheduleCommand {
  constructor(
    private readonly repository: SeasonOperationsRepository,
    private readonly auditRepository: SeasonOperationsAuditRepository,
  ) {}

  execute(
    campusCode: Campus,
    seasonId: string,
    input: UpdateSeasonScheduleRequest,
    actor: AuthenticatedUserContext,
  ) {
    assertValidSeasonSchedule(input);

    return this.repository.transaction(async (tx) => {
      const before = await this.repository.findByCampusAndId(tx, campusCode, seasonId);
      if (!before) {
        throw seasonsErrors.seasonNotFound();
      }

      const updateResult = await this.repository.updateScheduleIfVersionMatches(tx, {
        seasonId,
        campusCode,
        expectedUpdatedAt: new Date(input.expectedUpdatedAt),
        name: input.name,
        preparationStartDate: toDateOnly(input.preparationStartDate),
        matchingStartDate: toDateOnly(input.matchingStartDate),
        seasonEndDate: toDateOnly(input.seasonEndDate),
      });
      if (updateResult.count !== 1) {
        throw seasonsErrors.operationConflict();
      }

      const after = await this.repository.findByCampusAndId(tx, campusCode, seasonId);
      if (!after) {
        throw seasonsErrors.seasonNotFound();
      }

      const audit = await this.auditRepository.append({
        client: tx,
        action: SeasonOperationAuditAction.UPDATE_SCHEDULE,
        actor,
        seasonId,
        reason: input.reason,
        previousSeason: before,
        nextSeason: after,
        metadata: {
          expectedUpdatedAt: input.expectedUpdatedAt,
          changedFields: ['name', 'preparationStartDate', 'matchingStartDate', 'seasonEndDate'],
        },
      });

      return toSeasonOperationResponse({
        season: after,
        auditEventId: audit.id,
        action: SeasonOperationAuditAction.UPDATE_SCHEDULE,
      });
    });
  }
}

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
