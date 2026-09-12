import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonsController } from './seasons.controller.js';
import { seasonsErrors } from './errors/seasons.errors.js';

describe('SeasonsController parsed input delegation', () => {
  const seasonsService = { getCurrentSeason: vi.fn() };
  const controller = new SeasonsController(seasonsService as never);
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('passes the parsed campus and preserves the service response', async () => {
    const season = { id: 'season-1' };
    seasonsService.getCurrentSeason.mockResolvedValue(season);
    await expect(controller.getCurrentSeason('CHUNCHEON')).resolves.toBe(season);
    expect(seasonsService.getCurrentSeason).toHaveBeenCalledExactlyOnceWith('CHUNCHEON');
  });
  it('preserves the post-service current-season-not-found error', async () => {
    seasonsService.getCurrentSeason.mockResolvedValue(null);
    await expect(controller.getCurrentSeason('CHUNCHEON')).rejects.toEqual(
      seasonsErrors.currentSeasonNotFound(),
    );
  });
});
