import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { dormitoriesErrors } from './dormitories.errors.js';
import { DormitorySelectableQueryService } from './dormitory-selectable-query.service.js';
import {
  dormitoryCommonRuleSchema,
  dormitoryContactSchema,
  dormitoryGuideResponseSchema,
  dormitoryGuidePayloadSchema,
} from '@repo/shared/dormitory-contract';

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

  async getSelectableDormitories(campus: Campus, gender?: Gender) {
    return this.dormitorySelectableQueryService.getSelectableDormitories(campus, gender);
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

    const guidePayload = dormitoryGuidePayloadSchema.parse({
      bathroomType: dormitory.guide.bathroomType,
      facilities: dormitory.guide.facilities,
      repairContact: dormitory.guide.repairContact,
      diningContact: dormitory.guide.diningContact,
    });
    const commonRules = Array.isArray(dormitory.campus.guideContent.commonRules)
      ? dormitory.campus.guideContent.commonRules.map((rule) =>
          dormitoryCommonRuleSchema.parse(rule),
        )
      : dormitoryCommonRuleSchema.array().parse(dormitory.campus.guideContent.commonRules);
    const emergencyContacts = Array.isArray(dormitory.campus.guideContent.emergencyContacts)
      ? dormitory.campus.guideContent.emergencyContacts.map((contact) =>
          dormitoryContactSchema.parse(contact),
        )
      : dormitoryContactSchema.array().parse(dormitory.campus.guideContent.emergencyContacts);

    return dormitoryGuideResponseSchema.parse({
      dormitory: {
        id: dormitory.id,
        name: dormitory.nameKo,
        roomType: dormitory.roomType as 2 | 3,
      },
      guide: guidePayload,
      commonRules,
      emergencyContacts,
      homepageUrl: dormitory.campus.guideContent.homepageUrl,
    });
  }
}
