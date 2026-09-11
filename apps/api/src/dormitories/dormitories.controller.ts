import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  campusSchema,
  genderSchema,
  type Campus,
  type Gender,
} from '@repo/shared/identity/primitives';
import { DormitoriesService } from './application/dormitories.service.js';
import { Public } from '../auth/access/auth-access.decorator.js';
import { parseOptionalQueryValue, parseQueryValue } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';

interface DormitoriesQuery {
  campus: Campus;
  gender: Gender | undefined;
}

const dormitoriesQueryPipe = new ZodRequestPipe(
  (query: Record<string, unknown>): DormitoriesQuery => {
    const campus = parseQueryValue(campusSchema, query.campus, {
      code: 'DORMITORIES_INVALID_CAMPUS_QUERY',
      errorMessage: 'campus 쿼리 파라미터 값이 올바르지 않습니다.',
      fieldName: 'campus',
    });
    const gender = parseOptionalQueryValue(genderSchema, query.gender, {
      code: 'DORMITORIES_INVALID_GENDER_QUERY',
      errorMessage: 'gender 쿼리 파라미터 값이 올바르지 않습니다.',
      fieldName: 'gender',
    });
    return { campus, gender };
  },
);

@Controller('api/dormitories')
@Public()
export class DormitoriesController {
  constructor(private readonly dormitoriesService: DormitoriesService) {}

  @Get()
  async getDormitories(@Query(dormitoriesQueryPipe) query: DormitoriesQuery) {
    return this.dormitoriesService.getDormitories(query.campus, query.gender);
  }
  @Get(':id')
  async getDormitoryById(@Param('id') id: string) {
    return this.dormitoriesService.getDormitoryById(id);
  }
}
