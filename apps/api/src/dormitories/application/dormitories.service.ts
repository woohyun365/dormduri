import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { DormitoryCatalogQuery } from '../catalog/dormitory-catalog.query.js';

@Injectable()
export class DormitoriesService {
  constructor(private readonly dormitoryCatalogQuery: DormitoryCatalogQuery) {}

  getDormitories(campus: Campus, gender?: Gender) {
    return this.dormitoryCatalogQuery.getDormitories(campus, gender);
  }

  getDormitoryById(id: string) {
    return this.dormitoryCatalogQuery.getDormitoryById(id);
  }
}
