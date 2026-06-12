import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AUTH_ACCESS_METADATA_KEY } from '../auth/access/auth-access.decorator.js';
import { MatchesController } from './matches.controller.js';

describe('MatchesController', () => {
  const matchesService = {
    listCurrentSeasonRequests: vi.fn(),
    createMatchRequest: vi.fn(),
    acceptMatchRequest: vi.fn(),
    rejectMatchRequest: vi.fn(),
    cancelMatchRequest: vi.fn(),
    getCurrentActiveMatch: vi.fn(),
    getMatchHistory: vi.fn(),
    getMatchHistoryCounterpartProfile: vi.fn(),
    requestUnmatch: vi.fn(),
    cancelUnmatchRequest: vi.fn(),
  };
  const controller = new MatchesController(matchesService as never);
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('controller class는 protected auth metadata로 보호된다', () => {
    expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, MatchesController)).toBe('protected');
  });

  it('unmatch 요청은 active match context가 있으면 actor/param 일치 후 service로 위임한다', async () => {
    matchesService.requestUnmatch.mockResolvedValueOnce({
      activeMatch: { id: 'active-1' },
    });

    await expect(
      controller.requestUnmatch(authUser as never, 'active-1', {
        activeMatchId: 'active-1',
        actorUserId: 'user-1',
      } as never),
    ).resolves.toEqual({
      activeMatch: { id: 'active-1' },
    });

    expect(matchesService.requestUnmatch).toHaveBeenCalledWith(authUser, 'active-1');
  });

  it('unmatch 요청은 active match context와 auth actor가 다르면 fail-closed 처리한다', async () => {
    await expect(
      controller.requestUnmatch(authUser as never, 'active-1', {
        activeMatchId: 'active-1',
        actorUserId: 'other-user',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(matchesService.requestUnmatch).not.toHaveBeenCalled();
  });

  it('unmatch 요청은 active match context와 route param이 다르면 fail-closed 처리한다', async () => {
    await expect(
      controller.requestUnmatch(authUser as never, 'active-1', {
        activeMatchId: 'active-2',
        actorUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(matchesService.requestUnmatch).not.toHaveBeenCalled();
  });

  it('unmatch 취소도 active match context 검증 후 service로 위임한다', async () => {
    matchesService.cancelUnmatchRequest.mockResolvedValueOnce({
      activeMatch: { id: 'active-1' },
    });

    await expect(
      controller.cancelUnmatchRequest(authUser as never, 'active-1', {
        activeMatchId: 'active-1',
        actorUserId: 'user-1',
      } as never),
    ).resolves.toEqual({
      activeMatch: { id: 'active-1' },
    });

    expect(matchesService.cancelUnmatchRequest).toHaveBeenCalledWith(authUser, 'active-1');
  });

  it('unmatch 취소는 active match context와 route param이 다르면 fail-closed 처리한다', async () => {
    await expect(
      controller.cancelUnmatchRequest(authUser as never, 'active-1', {
        activeMatchId: 'active-2',
        actorUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(matchesService.cancelUnmatchRequest).not.toHaveBeenCalled();
  });
});
