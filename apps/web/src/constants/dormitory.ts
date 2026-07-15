import type { Campus } from '@/types/profile';

export const UNASSIGNED_ID = 'unassigned';

export interface Dormitory {
  id: string;
  name: string;
  roomType: 2 | 3;
  gender: 'M' | 'F' | 'BOTH';
  campus: Campus;
  isOperated: boolean;
}

export const DORMITORIES: Dormitory[] = [
  { id: 'toegye', name: '퇴계관', roomType: 3, gender: 'M', campus: 'CHUNCHEON', isOperated: true },
  { id: 'dasan', name: '다산관', roomType: 2, gender: 'M', campus: 'CHUNCHEON', isOperated: true },
  { id: 'yeji', name: '예지원', roomType: 2, gender: 'F', campus: 'CHUNCHEON', isOperated: true },
  { id: 'nanji', name: '난지원', roomType: 3, gender: 'F', campus: 'CHUNCHEON', isOperated: true },
  { id: 'gukji', name: '국지원', roomType: 3, gender: 'F', campus: 'CHUNCHEON', isOperated: true },
  {
    id: 'saerom',
    name: '새롬관',
    roomType: 2,
    gender: 'BOTH',
    campus: 'CHUNCHEON',
    isOperated: true,
  },
  {
    id: 'irum',
    name: '이룸관',
    roomType: 2,
    gender: 'BOTH',
    campus: 'CHUNCHEON',
    isOperated: true,
  },
  {
    id: 'daon',
    name: '다온관',
    roomType: 2,
    gender: 'BOTH',
    campus: 'CHUNCHEON',
    isOperated: true,
  },
];

export const CAMPUS_NAMES: Record<Campus, string> = {
  CHUNCHEON: '춘천캠퍼스',
  SAMCHEOK: '삼척캠퍼스',
  DOGYE: '도계캠퍼스',
};

/** 캠퍼스에 운영 중인 건물이 있는지 판단 */
export function isCampusOperated(campus: Campus): boolean {
  return DORMITORIES.some((d) => d.campus === campus && d.isOperated);
}

export function getAvailableDormitories(campus: Campus, gender: 'M' | 'F'): Dormitory[] {
  return DORMITORIES.filter(
    (d) => d.campus === campus && d.isOperated && (d.gender === gender || d.gender === 'BOTH'),
  );
}

export function getDormitoryById(id: string): Dormitory | undefined {
  return DORMITORIES.find((d) => d.id === id);
}
