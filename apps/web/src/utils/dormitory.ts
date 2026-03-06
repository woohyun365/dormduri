import { UNASSIGNED_ID } from '@/constants/dormitory';

export function isDormitoryAssigned(dormitoryId: string | null): dormitoryId is string {
  return dormitoryId !== null && dormitoryId !== UNASSIGNED_ID;
}
