import {
  getDormitoryById,
  isCampusOperated as isCampusOperatedByLocalCatalog,
} from '@/constants/dormitory';
import type { Campus } from '@/types/profile';

export interface DormitoryDisplayItem {
  readonly id: string;
  readonly name: string;
  readonly roomType: 2 | 3;
  readonly gender: 'M' | 'F' | 'BOTH';
  readonly campus: Campus;
  readonly isOperated: boolean;
}

export function getDormitoryDisplayById(
  dormitoryId: string | null | undefined,
): DormitoryDisplayItem | null {
  if (!dormitoryId) return null;
  return getDormitoryById(dormitoryId) ?? null;
}

export function isCampusOperatedByDormitoryDisplayCatalog(campus: Campus): boolean {
  return isCampusOperatedByLocalCatalog(campus);
}
