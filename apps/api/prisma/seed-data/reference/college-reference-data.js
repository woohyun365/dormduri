import { COLLEGE_CATALOG } from '@repo/shared/college-contract';

export const COLLEGE_MASTER_DATA = COLLEGE_CATALOG.map((item) => ({
  code: item.code,
  campusCode: item.campusCode,
  nameKo: item.nameKo,
  sortOrder: item.sortOrder,
  isActive: item.isActive,
}));
