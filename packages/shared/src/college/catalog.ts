import type { CollegeCatalogItem, CollegeCode } from './schema.js';

export const CHUNCHEON_COLLEGE_CATALOG = [
  { code: 'IT', campusCode: 'CHUNCHEON', nameKo: 'IT대', sortOrder: 1, isActive: true },
  { code: 'NURSING', campusCode: 'CHUNCHEON', nameKo: '간호대', sortOrder: 2, isActive: true },
  { code: 'BUSINESS', campusCode: 'CHUNCHEON', nameKo: '경영대', sortOrder: 3, isActive: true },
  {
    code: 'AGRICULTURE_LIFE',
    campusCode: 'CHUNCHEON',
    nameKo: '농업생명대',
    sortOrder: 4,
    isActive: true,
  },
  {
    code: 'ANIMAL_LIFE',
    campusCode: 'CHUNCHEON',
    nameKo: '동물생명대',
    sortOrder: 5,
    isActive: true,
  },
  {
    code: 'ARTS_ENGINEERING',
    campusCode: 'CHUNCHEON',
    nameKo: '문화예술·공대',
    sortOrder: 6,
    isActive: true,
  },
  { code: 'EDUCATION', campusCode: 'CHUNCHEON', nameKo: '사범대', sortOrder: 7, isActive: true },
  {
    code: 'SOCIAL_SCIENCES',
    campusCode: 'CHUNCHEON',
    nameKo: '사회과학대',
    sortOrder: 8,
    isActive: true,
  },
  {
    code: 'FOREST_ENVIRONMENT',
    campusCode: 'CHUNCHEON',
    nameKo: '산림환경대',
    sortOrder: 9,
    isActive: true,
  },
  {
    code: 'MEDICINE_PHARMACY_VETERINARY',
    campusCode: 'CHUNCHEON',
    nameKo: '의·약·수의대',
    sortOrder: 10,
    isActive: true,
  },
  {
    code: 'BIOMEDICAL_SCIENCE',
    campusCode: 'CHUNCHEON',
    nameKo: '의생명과학대',
    sortOrder: 11,
    isActive: true,
  },
  { code: 'HUMANITIES', campusCode: 'CHUNCHEON', nameKo: '인문대', sortOrder: 12, isActive: true },
  {
    code: 'NATURAL_SCIENCES',
    campusCode: 'CHUNCHEON',
    nameKo: '자연과학대',
    sortOrder: 13,
    isActive: true,
  },
  {
    code: 'OPEN_MAJOR',
    campusCode: 'CHUNCHEON',
    nameKo: '자유전공',
    sortOrder: 14,
    isActive: true,
  },
] as const satisfies readonly CollegeCatalogItem[];

export const COLLEGE_CATALOG = [...CHUNCHEON_COLLEGE_CATALOG] as const;
export const COLLEGE_CODES = COLLEGE_CATALOG.map((item) => item.code) as ReadonlyArray<CollegeCode>;
