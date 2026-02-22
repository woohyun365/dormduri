export const UNASSIGNED_ID = 'unassigned';

export interface Dormitory {
  id: string;
  name: string;
  roomType: 2 | 3;
  gender: 'M' | 'F' | 'BOTH';
}

export const DORMITORIES: Dormitory[] = [
  { id: 'toegye', name: '퇴계관', roomType: 3, gender: 'M' },
  { id: 'dasan', name: '다산관', roomType: 2, gender: 'M' },
  { id: 'yeji', name: '예지원', roomType: 2, gender: 'F' },
  { id: 'nanji', name: '난지원', roomType: 3, gender: 'F' },
  { id: 'gukji', name: '국지원', roomType: 3, gender: 'F' },
  { id: 'saerom', name: '새롬관', roomType: 2, gender: 'BOTH' },
  { id: 'irum', name: '이룸관', roomType: 2, gender: 'BOTH' },
  { id: 'daon', name: '다온관', roomType: 2, gender: 'BOTH' },
];

export function getAvailableDormitories(gender: 'M' | 'F'): Dormitory[] {
  return DORMITORIES.filter((d) => d.gender === gender || d.gender === 'BOTH');
}

export function getDormitoryById(id: string): Dormitory | undefined {
  return DORMITORIES.find((d) => d.id === id);
}

/** 건물의 인실 수 = 매칭에 필요한 인원 수 */
export function getMatchGroupSize(dormitoryId: string): number {
  return getDormitoryById(dormitoryId)?.roomType ?? 2;
}
