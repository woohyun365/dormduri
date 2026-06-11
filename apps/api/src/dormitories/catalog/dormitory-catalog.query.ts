import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { dormitoriesErrors } from '../errors/dormitories.errors.js';
import {
  mapDormitoryCatalogDetailResponse,
  mapDormitoryCatalogListResponse,
} from './dormitory-catalog.mapper.js';
import { DormitoryCatalogRepository } from './dormitory-catalog.repository.js';

@Injectable()
export class DormitoryCatalogQuery {
  constructor(private readonly dormitoryCatalogRepository: DormitoryCatalogRepository) {}

  async getDormitories(campus: Campus, gender?: Gender) {
    const campusMeta = await this.dormitoryCatalogRepository.findCampus(campus);

    if (!campusMeta) {
      throw dormitoriesErrors.campusNotFound();
    }

    const items = await this.dormitoryCatalogRepository.listDormitories(campus, gender);

    return mapDormitoryCatalogListResponse(campusMeta, items);
  }

  async getDormitoryById(id: string) {
    const dormitory = await this.dormitoryCatalogRepository.findDormitoryDetail(id);

    if (!dormitory) {
      throw dormitoriesErrors.dormitoryNotFound();
    }

    return mapDormitoryCatalogDetailResponse(dormitory);
  }
}
