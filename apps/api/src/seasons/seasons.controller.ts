import { Controller, Get, Query } from '@nestjs/common';
import { campusSchema, type Campus } from '@repo/shared/identity/primitives';
import { Public } from '../auth/access/auth-access.decorator.js';
import { SeasonsService } from './application/seasons.service.js';
import { parseQueryValue } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { seasonsErrors } from './errors/seasons.errors.js';

@Controller('api/seasons')
@Public()
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get('current')
  async getCurrentSeason(
    @Query(
      'campus',
      new ZodRequestPipe((campus: unknown) =>
        parseQueryValue(campusSchema, campus, {
          code: 'SEASONS_INVALID_CAMPUS_QUERY',
          errorMessage: 'campus 쿼리 파라미터 값이 올바르지 않습니다.',
          fieldName: 'campus',
        }),
      ),
    )
    parsedCampus: Campus,
  ) {
    const season = await this.seasonsService.getCurrentSeason(parsedCampus);
    if (!season) {
      throw seasonsErrors.currentSeasonNotFound();
    }
    return season;
  }
}
