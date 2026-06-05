import type { Campus, DormitoryGenderPolicy } from '../../generated/prisma/enums.js';

export interface DormitoryCatalogCampusRecord {
  code: Campus;
  nameKo: string;
  isOperated: boolean;
}

export interface DormitoryCatalogItemRecord {
  id: string;
  nameKo: string;
  roomType: number;
  genderPolicy: DormitoryGenderPolicy;
}

export interface DormitoryCatalogDetailRecord extends DormitoryCatalogItemRecord {
  campus: DormitoryCatalogCampusRecord;
}

export function mapDormitoryCatalogListResponse(
  campus: DormitoryCatalogCampusRecord,
  items: readonly DormitoryCatalogItemRecord[],
) {
  return {
    campus,
    items: items.map((item) => ({
      id: item.id,
      name: item.nameKo,
      roomType: item.roomType as 2 | 3,
      genderPolicy: item.genderPolicy,
      isOperated: campus.isOperated,
    })),
  };
}

export function mapDormitoryCatalogDetailResponse(dormitory: DormitoryCatalogDetailRecord) {
  return {
    id: dormitory.id,
    campusCode: dormitory.campus.code,
    campusNameKo: dormitory.campus.nameKo,
    name: dormitory.nameKo,
    roomType: dormitory.roomType as 2 | 3,
    genderPolicy: dormitory.genderPolicy,
    isOperated: dormitory.campus.isOperated,
  };
}
