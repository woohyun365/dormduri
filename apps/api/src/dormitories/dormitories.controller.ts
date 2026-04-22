import { Controller, Get, Param, Query } from '@nestjs/common';
import { campusSchema, genderSchema } from '@repo/shared/auth-contract';
import { DormitoriesService } from './dormitories.service.js';
import { dormitoriesErrors } from './dormitories.errors.js';

@Controller('api/dormitories')
export class DormitoriesController {
  constructor(private readonly dormitoriesService: DormitoriesService) {}

  @Get()
  async getDormitories(
    @Query('campus') campus: string | undefined,
    @Query('gender') gender?: string,
  ) {
    const parsedCampus = campusSchema.safeParse(campus);
    if (!parsedCampus.success) {
      throw dormitoriesErrors.invalidCampusQuery();
    }

    const parsedGender =
      gender == null
        ? ({ success: true, data: undefined } as const)
        : genderSchema.safeParse(gender);
    if (!parsedGender.success) {
      throw dormitoriesErrors.invalidGenderQuery();
    }

    return this.dormitoriesService.getDormitories(parsedCampus.data, parsedGender.data);
  }

  @Get('selectable')
  async getSelectableDormitories(
    @Query('campus') campus: string | undefined,
    @Query('gender') gender?: string,
  ) {
    const parsedCampus = campusSchema.safeParse(campus);
    if (!parsedCampus.success) {
      throw dormitoriesErrors.invalidCampusQuery();
    }

    const parsedGender =
      gender == null
        ? ({ success: true, data: undefined } as const)
        : genderSchema.safeParse(gender);
    if (!parsedGender.success) {
      throw dormitoriesErrors.invalidGenderQuery();
    }

    return this.dormitoriesService.getSelectableDormitories(parsedCampus.data, parsedGender.data);
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
