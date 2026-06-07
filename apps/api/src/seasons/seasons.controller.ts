import { Controller, Get, Query } from '@nestjs/common';
import { campusSchema } from '@repo/shared/identity-contract';
import { Public } from '../auth/access/auth-access.decorator.js';
import { SeasonsService } from './application/seasons.service.js';
import { parseQueryValue } from '../platform/http/zod-request.js';
import { seasonsErrors } from './errors/seasons.errors.js';

@Controller('api/seasons')
@Public()
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get('current')
  async getCurrentSeason(@Query('campus') campus: string | undefined) {
    const parsedCampus = parseQueryValue(campusSchema, campus, {
      code: 'SEASONS_INVALID_CAMPUS_QUERY',
      errorMessage: 'campus 쿼리 파라미터 값이 올바르지 않습니다.',
      fieldName: 'campus',
    });

    const season = await this.seasonsService.getCurrentSeason(parsedCampus);
    if (!season) {
      throw seasonsErrors.currentSeasonNotFound();
    }
    return season;
  }
}
