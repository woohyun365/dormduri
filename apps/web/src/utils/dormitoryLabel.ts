import type { DormitoryPublicSummary } from '@repo/shared/dormitory';

export function getDormitoryLabel(
  dormitoryId: string | null,
  dormitory?: DormitoryPublicSummary | null,
): string {
  if (!dormitoryId || dormitory?.id !== dormitoryId) return '';
  return `${dormitory.name} ${dormitory.roomType}인실`;
}
