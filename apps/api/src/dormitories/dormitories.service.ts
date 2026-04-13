import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { dormitoriesErrors } from './dormitories.errors.js';

@Injectable()
export class DormitoriesService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      dormitory: {
        id: dormitory.id,
        name: dormitory.nameKo,
        roomType: dormitory.roomType as 2 | 3,
      },
      guide: {
        bathroomType: dormitory.guide.bathroomType,
        facilities: dormitory.guide.facilities as string[],
        repairContact: dormitory.guide.repairContact,
        diningContact: dormitory.guide.diningContact,
      },
      commonRules: dormitory.campus.guideContent.commonRules as {
        emoji: string;
        label: string;
        value: string;
      }[],
      emergencyContacts: dormitory.campus.guideContent.emergencyContacts as {
        label: string;
        value: string;
      }[],
      homepageUrl: dormitory.campus.guideContent.homepageUrl,
    };
  }
}
