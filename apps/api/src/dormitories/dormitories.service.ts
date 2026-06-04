import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { dormitoriesErrors } from './dormitories.errors.js';
import {
  DormitorySelectableQueryService,
  type DormitorySelectionValidationResult,
  type SeasonParticipantDormitorySelectionInput,
  type SeasonParticipantDormitoryValidationInput,
} from './dormitory-selectable-query.service.js';
import { mapDormitoryGuideResponse } from './dormitory-guide.mapper.js';

@Injectable()
export class DormitoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dormitorySelectableQueryService: DormitorySelectableQueryService,
  ) {}

  async getDormitories(campus: Campus, gender?: Gender) {
    const campusMeta = await this.prisma.campusMaster.findUnique({
      where: { code: campus },
      select: {
        code: true,
        nameKo: true,
        isOperated: true,
      },
    });

    if (!campusMeta) {
      throw dormitoriesErrors.campusNotFound();
    }

    const items = await this.prisma.dormitory.findMany({
      where: {
        campusCode: campus,
        ...(gender ? { OR: [{ genderPolicy: gender }, { genderPolicy: 'BOTH' }] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nameKo: true,
        roomType: true,
        genderPolicy: true,
      },
    });

    return {
      campus: campusMeta,
      items: items.map((item) => ({
        id: item.id,
        name: item.nameKo,
        roomType: item.roomType as 2 | 3,
        genderPolicy: item.genderPolicy,
        isOperated: campusMeta.isOperated,
      })),
    };
  }
  async listSelectableDormitoriesForSeasonParticipant(
    input: SeasonParticipantDormitorySelectionInput,
  ) {
    return this.dormitorySelectableQueryService.listSelectableDormitoriesForSeasonParticipant(
      input,
    );
  }

  async validateSelectableDormitoryForSeasonParticipant(
    input: SeasonParticipantDormitoryValidationInput,
  ): Promise<DormitorySelectionValidationResult> {
    return this.dormitorySelectableQueryService.validateSelectableDormitoryForSeasonParticipant(
      input,
    );
  }

  async getDormitoryById(id: string) {
    const dormitory = await this.prisma.dormitory.findUnique({
      where: { id },
      select: {
        id: true,
        nameKo: true,
        roomType: true,
        genderPolicy: true,
        campus: {
          select: {
            code: true,
            nameKo: true,
            isOperated: true,
          },
        },
      },
    });

    if (!dormitory) {
      throw dormitoriesErrors.dormitoryNotFound();
    }

    return {
      id: dormitory.id,
      campusCode: dormitory.campus.code,
      campusNameKo: dormitory.campus.nameKo,
      name: dormitory.nameKo,
      roomType: dormitory.roomType as 2 | 3,
      genderPolicy: dormitory.genderPolicy,
      isOperated: dormitory.campus.isOperated,
    };
  }

  async getDormitoryGuide(id: string) {
    const dormitory = await this.prisma.dormitory.findUnique({
      where: { id },
      select: {
        id: true,
        nameKo: true,
        roomType: true,
        campus: {
          select: {
            guideContent: {
              select: {
                commonRules: true,
                emergencyContacts: true,
                homepageUrl: true,
              },
            },
          },
        },
        guide: {
          select: {
            bathroomType: true,
            facilities: true,
            repairContact: true,
            diningContact: true,
          },
        },
      },
    });

    if (!dormitory || !dormitory.guide) {
      throw dormitoriesErrors.dormitoryGuideNotFound();
    }

    if (!dormitory.campus.guideContent) {
      throw dormitoriesErrors.dormitoryGuideConfigNotFound();
    }

    return mapDormitoryGuideResponse({
      id: dormitory.id,
      nameKo: dormitory.nameKo,
      roomType: dormitory.roomType,
      campus: {
        guideContent: dormitory.campus.guideContent,
      },
      guide: dormitory.guide,
    });
  }
}
