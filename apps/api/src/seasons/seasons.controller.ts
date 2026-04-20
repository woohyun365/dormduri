import { Controller, Get } from '@nestjs/common';
import { SeasonsService } from './seasons.service.js';
import { seasonsErrors } from './seasons.errors.js';

@Controller('api/seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get('current')
  async getCurrentSeason() {
    const season = await this.seasonsService.getCurrentSeason();
    if (!season) {
      throw seasonsErrors.currentSeasonNotFound();
    }
    return season;
  }
}
