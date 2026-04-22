import { Controller, Get, Query } from '@nestjs/common';
import { campusSchema } from '@repo/shared/auth-contract';
import { SeasonsService } from './seasons.service.js';
import { seasonsErrors } from './seasons.errors.js';

@Controller('api/seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get('current')
  async getCurrentSeason(@Query('campus') campus: string | undefined) {
    const parsedCampus = campusSchema.safeParse(campus);
    if (!parsedCampus.success) {
      throw seasonsErrors.invalidCampusQuery();
    }

    const season = await this.seasonsService.getCurrentSeason(parsedCampus.data);
    if (!season) {
      throw seasonsErrors.currentSeasonNotFound();
    }
    return season;
  }
}
