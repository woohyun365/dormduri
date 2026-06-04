import { Controller, Get, Param, Query } from '@nestjs/common';
import { campusSchema, genderSchema } from '@repo/shared/identity-contract';
import { DormitoriesService } from './application/dormitories.service.js';
import { Public } from '../auth/access/auth-access.decorator.js';
import { parseOptionalQueryValue, parseQueryValue } from '../platform/http/zod-request.js';

@Controller('api/dormitories')
@Public()
export class DormitoriesController {
  constructor(private readonly dormitoriesService: DormitoriesService) {}

  @Get()
  async getDormitories(
    @Query('campus') campus: string | undefined,
    @Query('gender') gender?: string,
  ) {
    const parsedCampus = parseQueryValue(campusSchema, campus, {
      code: 'DORMITORIES_INVALID_CAMPUS_QUERY',
      errorMessage: 'campus 쿼리 파라미터 값이 올바르지 않습니다.',
      fieldName: 'campus',
    });

    const parsedGender = parseOptionalQueryValue(genderSchema, gender, {
      code: 'DORMITORIES_INVALID_GENDER_QUERY',
      errorMessage: 'gender 쿼리 파라미터 값이 올바르지 않습니다.',
      fieldName: 'gender',
    });

    return this.dormitoriesService.getDormitories(parsedCampus, parsedGender);
  }
  @Get(':id')
  async getDormitoryById(@Param('id') id: string) {
    return this.dormitoriesService.getDormitoryById(id);
  }

  @Get(':id/guide')
  async getDormitoryGuide(@Param('id') id: string) {
    return this.dormitoriesService.getDormitoryGuide(id);
  }
}
