import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { DormitoryCatalogQuery } from '../catalog/dormitory-catalog.query.js';
import { DormitoryGuideQuery } from '../guides/dormitory-guide.query.js';

@Injectable()
export class DormitoriesService {
  constructor(
    private readonly dormitoryCatalogQuery: DormitoryCatalogQuery,
    private readonly dormitoryGuideQuery: DormitoryGuideQuery,
  ) {}

  getDormitories(campus: Campus, gender?: Gender) {
    return this.dormitoryCatalogQuery.getDormitories(campus, gender);
  }

  getDormitoryById(id: string) {
    return this.dormitoryCatalogQuery.getDormitoryById(id);
  }

  getDormitoryGuide(id: string) {
    return this.dormitoryGuideQuery.getDormitoryGuide(id);
  }
}
