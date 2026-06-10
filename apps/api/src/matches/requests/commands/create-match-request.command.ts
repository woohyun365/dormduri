import { Injectable } from '@nestjs/common';
import type {
  CreateMatchRequestRequest,
  MatchRequestActionResponse,
} from '@repo/shared/match-contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { toMatchRequestSummary } from '../presenters/match-request.presenter.js';
import { MatchRequestCreationEvaluator } from '../eligibility/match-request-creation.evaluator.js';
import { MatchRequestRepository } from '../persistence/match-request.repository.js';

@Injectable()
export class CreateMatchRequestCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creationEvaluator: MatchRequestCreationEvaluator,
    private readonly matchRequestRepository: MatchRequestRepository,
  ) {}

  async execute(
    authUser: AuthenticatedUserContext,
    input: CreateMatchRequestRequest,
  ): Promise<MatchRequestActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const prepared = await this.creationEvaluator.prepareMatchRequestCreation(
      authUser.id,
      input,
      now,
    );
    const createdRequest = await this.prisma.runSerializableTransaction((tx) =>
      this.matchRequestRepository.createPendingMatchRequest(tx, prepared, now),
    );

    return {
      request: toMatchRequestSummary(createdRequest, prepared.requesterParticipantId),
      activeMatch: null,
    };
  }
}
