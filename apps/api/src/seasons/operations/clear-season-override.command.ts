import { Injectable, Optional } from '@nestjs/common';
import type { ClearSeasonOverrideRequest } from '@repo/shared/season/operations';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { SeasonOperationAuditAction } from '../../generated/prisma/enums.js';
import { seasonsErrors } from '../seasons.errors.js';
import type { SeasonOperationMetricOutcome } from './season-operational-metrics.service.js';
import { SeasonOperationalMetricsService } from './season-operational-metrics.service.js';
import { SeasonOperationsAuditRepository } from './season-operations-audit.repository.js';
import { toSeasonOperationResponse } from './season-operations.mapper.js';
import { SeasonOperationsRepository } from './season-operations.repository.js';

@Injectable()
export class ClearSeasonOverrideCommand {
  constructor(
    private readonly repository: SeasonOperationsRepository,
    private readonly auditRepository: SeasonOperationsAuditRepository,
    @Optional() private readonly metrics?: SeasonOperationalMetricsService,
  ) {}

  execute(
    campusCode: Campus,
    seasonId: string,
    input: ClearSeasonOverrideRequest,
    actor: AuthenticatedUserContext,
  ) {
    let metricRecorded = false;
    const recordMetric = (outcome: SeasonOperationMetricOutcome) => {
      metricRecorded = true;
      this.recordMetric(campusCode, outcome);
    };

    return this.repository
      .transaction(async (tx) => {
        const before = await this.repository.findByCampusAndId(tx, campusCode, seasonId);
        if (!before) {
          recordMetric('not_found');
          throw seasonsErrors.seasonNotFound();
        }

        const updateResult = await this.repository.clearOverrideIfVersionMatches(tx, {
          seasonId,
          campusCode,
          expectedUpdatedAt: new Date(input.expectedUpdatedAt),
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
            action: SeasonOperationAuditAction.CLEAR_OVERRIDE,
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
          action: SeasonOperationAuditAction.CLEAR_OVERRIDE,
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
      action: SeasonOperationAuditAction.CLEAR_OVERRIDE,
      campusCode,
      outcome,
    });
  }
}
