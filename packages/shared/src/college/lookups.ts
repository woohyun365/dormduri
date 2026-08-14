import type { Campus } from '../identity/primitives.js';
import { COLLEGE_CATALOG } from './catalog.js';
import type { CollegeCode } from './schema.js';

const COLLEGE_LABEL_BY_CODE: Record<CollegeCode, string> = Object.fromEntries(
  COLLEGE_CATALOG.map((item) => [item.code, item.nameKo]),
) as Record<CollegeCode, string>;

export function getCollegeCatalog(campusCode: Campus) {
  return COLLEGE_CATALOG.filter((item) => item.campusCode === campusCode);
}

export function getCollegeLabel(collegeCode: CollegeCode | null | undefined): string | null {
  if (!collegeCode) {
    return null;
  }

  return COLLEGE_LABEL_BY_CODE[collegeCode] ?? null;
}

export function getCollegeCodeByLabel(
  label: string | null | undefined,
  campusCode?: Campus,
): CollegeCode | null {
  if (!label) {
    return null;
  }

  const matches = COLLEGE_CATALOG.filter(
    (item) => item.nameKo === label && (!campusCode || item.campusCode === campusCode),
  );

  return matches.length === 1 ? (matches[0]?.code ?? null) : null;
}

export function isCollegeAvailableForCampus(campusCode: Campus, collegeCode: CollegeCode): boolean {
  return getCollegeCatalog(campusCode).some((item) => item.code === collegeCode && item.isActive);
}
