import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  DormitoryCatalogCampusRecord,
  DormitoryCatalogDetailRecord,
  DormitoryCatalogItemRecord,
} from './dormitory-catalog.mapper.js';

@Injectable()
export class DormitoryCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCampus(campus: Campus): Promise<DormitoryCatalogCampusRecord | null> {
    return this.prisma.campusMaster.findUnique({
      where: { code: campus },
      select: {
        code: true,
        nameKo: true,
        isOperated: true,
      },
    });
  }

  listDormitories(campus: Campus, gender?: Gender): Promise<DormitoryCatalogItemRecord[]> {
    return this.prisma.dormitory.findMany({
      where: {
        campusCode: campus,
        ...(gender ? { OR: [{ genderPolicy: gender }, { genderPolicy: 'BOTH' }] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nameKo: true,
        roomType: true,
        genderPolicy: true,
      },
    });
  }

  findDormitoryDetail(id: string): Promise<DormitoryCatalogDetailRecord | null> {
    return this.prisma.dormitory.findUnique({
      where: { id },
      select: {
        id: true,
        nameKo: true,
        roomType: true,
        genderPolicy: true,
        campus: {
          select: {
            code: true,
            nameKo: true,
            isOperated: true,
          },
        },
      },
    });
  }
}
