import type { Campus } from './identity-contract.js';
import { COLLEGE_CATALOG } from './college-contract-catalog.js';
import type { CollegeCode } from './college-contract-schema.js';

const COLLEGE_LABEL_BY_CODE: Record<CollegeCode, string> = Object.fromEntries(
  COLLEGE_CATALOG.map((item) => [item.code, item.nameKo]),
) as Record<CollegeCode, string>;

const COLLEGE_CODE_BY_LABEL: Record<string, CollegeCode> = Object.fromEntries(
  COLLEGE_CATALOG.map((item) => [item.nameKo, item.code]),
) as Record<string, CollegeCode>;

export function getCollegeCatalog(campusCode: Campus) {
  return COLLEGE_CATALOG.filter((item) => item.campusCode === campusCode);
}

export function getCollegeLabel(collegeCode: CollegeCode | null | undefined): string | null {
  if (!collegeCode) {
    return null;
  }

  return COLLEGE_LABEL_BY_CODE[collegeCode] ?? null;
}

export function getCollegeCodeByLabel(label: string | null | undefined): CollegeCode | null {
  if (!label) {
    return null;
  }

  return COLLEGE_CODE_BY_LABEL[label] ?? null;
}
