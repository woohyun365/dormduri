import { Injectable } from '@nestjs/common';
import type { MatchRequestListResponse } from '@repo/shared/match/contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { MatchOverviewQuery } from '../../overview/match-overview.query.js';

@Injectable()
export class ListCurrentSeasonRequestsQuery {
  constructor(private readonly matchOverviewQuery: MatchOverviewQuery) {}

  async execute(authUser: AuthenticatedUserContext): Promise<MatchRequestListResponse> {
    const overview = await this.matchOverviewQuery.execute(authUser);
    const items = [...overview.sentRequests, ...overview.receivedRequests].sort((a, b) => {
      const createdAtOrder = b.createdAt.localeCompare(a.createdAt);
      return createdAtOrder !== 0 ? createdAtOrder : b.id.localeCompare(a.id);
    });

    return { items };
  }
}
