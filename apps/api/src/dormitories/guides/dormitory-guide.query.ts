import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { dormitoriesErrors } from '../errors/dormitories.errors.js';
import { mapDormitoryGuideResponse } from './dormitory-guide.mapper.js';

@Injectable()
export class DormitoryGuideQuery {
  constructor(private readonly prisma: PrismaService) {}

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
