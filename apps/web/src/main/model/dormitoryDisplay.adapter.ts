import type { DormitoryItem, DormitoryPublicSummary } from '@repo/shared/dormitory';
import type { DormitorySeasonOperation } from '@repo/shared/season/runtime';

export type DormitoryDisplayItem = DormitoryPublicSummary;

export function toDormitoryDisplayItem(item: DormitoryItem): DormitoryDisplayItem {
  return {
    id: item.id,
    name: item.name,
    roomType: item.roomType,
    genderPolicy: item.genderPolicy,
  };
}

export function getDormitoryDisplayFromSeasonOperations(
  dormitoryId: string | null | undefined,
  operations: readonly DormitorySeasonOperation[],
): DormitoryDisplayItem | null {
  if (!dormitoryId) return null;
  const operation = operations.find((item) => item.dormitoryId === dormitoryId);
  return operation?.dormitory ?? null;
}
