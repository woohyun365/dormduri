import { Injectable, Optional } from '@nestjs/common';
import type { UpdateSeasonOverrideRequest } from '@repo/shared/season-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { SeasonOperationAuditAction } from '../../generated/prisma/enums.js';
import { seasonsErrors } from '../seasons.errors.js';
import type { SeasonOperationMetricOutcome } from './season-operational-metrics.service.js';
import { SeasonOperationalMetricsService } from './season-operational-metrics.service.js';
import { assertValidSeasonOverride } from './season-operations.policy.js';
import { SeasonOperationsAuditRepository } from './season-operations-audit.repository.js';
import { toSeasonOperationResponse } from './season-operations.mapper.js';
import { SeasonOperationsRepository } from './season-operations.repository.js';

@Injectable()
export class UpdateSeasonOverrideCommand {
  constructor(
    private readonly repository: SeasonOperationsRepository,
    private readonly auditRepository: SeasonOperationsAuditRepository,
    @Optional() private readonly metrics?: SeasonOperationalMetricsService,
  ) {}

  execute(
    campusCode: Campus,
    seasonId: string,
    input: UpdateSeasonOverrideRequest,
    actor: AuthenticatedUserContext,
  ) {
    let metricRecorded = false;
    const recordMetric = (outcome: SeasonOperationMetricOutcome) => {
      metricRecorded = true;
      this.recordMetric(campusCode, outcome);
    };

    try {
      assertValidSeasonOverride(input);
    } catch (error) {
      recordMetric('validation_failure');
      throw error;
    }

    return this.repository
      .transaction(async (tx) => {
        const before = await this.repository.findByCampusAndId(tx, campusCode, seasonId);
        if (!before) {
          recordMetric('not_found');
          throw seasonsErrors.seasonNotFound();
        }

        const updateResult = await this.repository.updateOverrideIfVersionMatches(tx, {
          seasonId,
          campusCode,
          expectedUpdatedAt: new Date(input.expectedUpdatedAt),
          overrideState: input.state,
          overrideReason: input.reason,
          overrideStartedAt: input.startsAt ? new Date(input.startsAt) : null,
          overrideEndsAt: input.endsAt ? new Date(input.endsAt) : null,
        });
        if (updateResult.count !== 1) {
          recordMetric('conflict');
          throw seasonsErrors.operationConflict();
        }

        const after = await this.repository.findByCampusAndId(tx, campusCode, seasonId);
        if (!after) {
          recordMetric('not_found');
          throw seasonsErrors.seasonNotFound();
        }

        let audit: Awaited<ReturnType<SeasonOperationsAuditRepository['append']>>;
        try {
          audit = await this.auditRepository.append({
            client: tx,
            action: SeasonOperationAuditAction.UPDATE_OVERRIDE,
            actor,
            seasonId,
            reason: input.reason,
            previousSeason: before,
            nextSeason: after,
            metadata: {
              expectedUpdatedAt: input.expectedUpdatedAt,
              changedFields: [
                'overrideState',
                'overrideReason',
                'overrideStartedAt',
                'overrideEndsAt',
              ],
            },
          });
        } catch (error) {
          recordMetric('audit_failure');
          throw error;
        }

        recordMetric('success');

        return toSeasonOperationResponse({
          season: after,
          auditEventId: audit.id,
          action: SeasonOperationAuditAction.UPDATE_OVERRIDE,
        });
      })
      .catch((error: unknown) => {
        if (!metricRecorded) {
          this.recordMetric(campusCode, 'failure');
        }

        throw error;
      });
  }

  private recordMetric(campusCode: Campus, outcome: SeasonOperationMetricOutcome) {
    this.metrics?.recordOperation({
      action: SeasonOperationAuditAction.UPDATE_OVERRIDE,
      campusCode,
      outcome,
    });
  }
}
