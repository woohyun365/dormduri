import { getDormitoryById } from '@/constants/dormitory';

export function getDormitoryLabel(dormitoryId: string | null): string {
  if (!dormitoryId) return '';
  const dorm = getDormitoryById(dormitoryId);
  return dorm ? `${dorm.name} ${dorm.roomType}인실` : '';
}
