import {
  dormitoryCommonRuleSchema,
  dormitoryContactSchema,
  dormitoryGuideResponseSchema,
  dormitoryGuidePayloadSchema,
} from '@repo/shared/dormitory';

export interface DormitoryGuideViewRecord {
  id: string;
  nameKo: string;
  roomType: number;
  campus: {
    guideContent: {
      commonRules: unknown;
      emergencyContacts: unknown;
      homepageUrl: string;
    };
  };
  guide: {
    bathroomType: unknown;
    facilities: unknown;
    repairContact: unknown;
    diningContact: unknown;
  };
}

export function mapDormitoryGuideResponse(dormitory: DormitoryGuideViewRecord) {
  const guidePayload = dormitoryGuidePayloadSchema.parse({
    bathroomType: dormitory.guide.bathroomType,
    facilities: dormitory.guide.facilities,
    repairContact: dormitory.guide.repairContact,
    diningContact: dormitory.guide.diningContact,
  });
  const commonRules = Array.isArray(dormitory.campus.guideContent.commonRules)
    ? dormitory.campus.guideContent.commonRules.map((rule) => dormitoryCommonRuleSchema.parse(rule))
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
