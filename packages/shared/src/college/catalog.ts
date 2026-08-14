import type { CollegeCatalogItem, CollegeCode } from './schema.js';

export const CHUNCHEON_COLLEGE_CATALOG = [
  {
    code: 'CHUNCHEON_NURSING',
    campusCode: 'CHUNCHEON',
    nameKo: '간호대',
    sortOrder: 1,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_BUSINESS',
    campusCode: 'CHUNCHEON',
    nameKo: '경영대',
    sortOrder: 2,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_AGRICULTURE_LIFE',
    campusCode: 'CHUNCHEON',
    nameKo: '농업생명대',
    sortOrder: 3,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_ANIMAL_LIFE',
    campusCode: 'CHUNCHEON',
    nameKo: '동물생명대',
    sortOrder: 4,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_ARTS_ENGINEERING',
    campusCode: 'CHUNCHEON',
    nameKo: '문화예술·공대',
    sortOrder: 5,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_EDUCATION',
    campusCode: 'CHUNCHEON',
    nameKo: '사범대',
    sortOrder: 6,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_SOCIAL_SCIENCES',
    campusCode: 'CHUNCHEON',
    nameKo: '사회과학대',
    sortOrder: 7,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_FOREST_ENVIRONMENT',
    campusCode: 'CHUNCHEON',
    nameKo: '산림환경대',
    sortOrder: 8,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_VETERINARY_MEDICINE',
    campusCode: 'CHUNCHEON',
    nameKo: '수의대',
    sortOrder: 9,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_PHARMACY',
    campusCode: 'CHUNCHEON',
    nameKo: '약대',
    sortOrder: 10,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_MEDICINE',
    campusCode: 'CHUNCHEON',
    nameKo: '의대',
    sortOrder: 11,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_BIOMEDICAL_SCIENCE',
    campusCode: 'CHUNCHEON',
    nameKo: '의생명과학대',
    sortOrder: 12,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_HUMANITIES',
    campusCode: 'CHUNCHEON',
    nameKo: '인문대',
    sortOrder: 13,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_NATURAL_SCIENCES',
    campusCode: 'CHUNCHEON',
    nameKo: '자연과학대',
    sortOrder: 14,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_IT',
    campusCode: 'CHUNCHEON',
    nameKo: 'IT대',
    sortOrder: 15,
    isActive: true,
  },
  {
    code: 'CHUNCHEON_GLOBAL_FUTURE_CONVERGENCE',
    campusCode: 'CHUNCHEON',
    nameKo: '글로벌미래융합대',
    sortOrder: 16,
    isActive: true,
  },
] as const satisfies readonly CollegeCatalogItem[];

export const SAMCHEOK_COLLEGE_CATALOG = [
  {
    code: 'SAMCHEOK_ENGINEERING',
    campusCode: 'SAMCHEOK',
    nameKo: '공학대',
    sortOrder: 1,
    isActive: true,
  },
  {
    code: 'SAMCHEOK_HUMANITIES_SOCIAL',
    campusCode: 'SAMCHEOK',
    nameKo: '인문사회대',
    sortOrder: 2,
    isActive: true,
  },
  {
    code: 'SAMCHEOK_DESIGN_SPORTS',
    campusCode: 'SAMCHEOK',
    nameKo: '디자인스포츠대',
    sortOrder: 3,
    isActive: true,
  },
] as const satisfies readonly CollegeCatalogItem[];

export const DOGYE_COLLEGE_CATALOG = [
  {
    code: 'DOGYE_ENGINEERING',
    campusCode: 'DOGYE',
    nameKo: '공학대',
    sortOrder: 1,
    isActive: true,
  },
  {
    code: 'DOGYE_HUMANITIES_SOCIAL',
    campusCode: 'DOGYE',
    nameKo: '인문사회대',
    sortOrder: 2,
    isActive: true,
  },
  {
    code: 'DOGYE_HEALTH_SCIENCES',
    campusCode: 'DOGYE',
    nameKo: '보건과학대',
    sortOrder: 3,
    isActive: true,
  },
  {
    code: 'DOGYE_OPEN_MAJOR',
    campusCode: 'DOGYE',
    nameKo: '자유전공학부',
    sortOrder: 4,
    isActive: true,
  },
] as const satisfies readonly CollegeCatalogItem[];

export const COLLEGE_CATALOG = [
  ...CHUNCHEON_COLLEGE_CATALOG,
  ...SAMCHEOK_COLLEGE_CATALOG,
  ...DOGYE_COLLEGE_CATALOG,
] as const;
export const COLLEGE_CODES = COLLEGE_CATALOG.map((item) => item.code) as ReadonlyArray<CollegeCode>;
