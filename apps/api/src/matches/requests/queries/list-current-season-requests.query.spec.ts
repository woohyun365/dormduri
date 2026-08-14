import { describe, expect, it, vi } from 'vitest';
import { ListCurrentSeasonRequestsQuery } from './list-current-season-requests.query.js';

describe('ListCurrentSeasonRequestsQuery', () => {
  it('overview의 canonical action projection을 재사용하고 createdAt/id 순서를 보존한다', async () => {
    const sent = { id: 'request-b', createdAt: '2026-02-10T02:00:00.000Z' };
    const received = { id: 'request-a', createdAt: '2026-02-10T03:00:00.000Z' };
    const matchOverviewQuery = {
      execute: vi.fn().mockResolvedValue({
        sentRequests: [sent],
        receivedRequests: [received],
      }),
    };
    const query = new ListCurrentSeasonRequestsQuery(matchOverviewQuery as never);
    const authUser = { id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never;

    await expect(query.execute(authUser)).resolves.toEqual({ items: [received, sent] });
    expect(matchOverviewQuery.execute).toHaveBeenCalledWith(authUser);
  });
});
