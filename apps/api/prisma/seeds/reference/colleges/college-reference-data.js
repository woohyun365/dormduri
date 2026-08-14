import { COLLEGE_CATALOG } from '@repo/shared/college';

export const COLLEGE_REFERENCE_DATA = Object.freeze(
  COLLEGE_CATALOG.map((item) =>
    Object.freeze({
      code: item.code,
      campusCode: item.campusCode,
      nameKo: item.nameKo,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    }),
  ),
);
