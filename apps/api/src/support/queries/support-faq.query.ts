import { Injectable } from '@nestjs/common';
import type {
  ListSupportFaqQuery,
  SupportFaqDetailResponse,
  SupportFaqListResponse,
} from '@repo/shared/support';
import { supportErrors } from '../errors/support.errors.js';
import {
  toSupportFaqDetailResponse,
  toSupportFaqListResponse,
} from '../presenters/support-faq.presenter.js';
import { SupportFaqRepository } from '../repositories/support-faq.repository.js';

@Injectable()
export class SupportFaqQuery {
  constructor(private readonly repository: SupportFaqRepository) {}

  async list(query: ListSupportFaqQuery): Promise<SupportFaqListResponse> {
    const records = query.surface
      ? await this.repository.listPublishedForSurface({
          surface: query.surface,
          category: query.category,
        })
      : await this.repository.listPublished({ category: query.category });
    return toSupportFaqListResponse(records);
  }

  async get(articleId: string): Promise<SupportFaqDetailResponse> {
    const record = await this.repository.findPublishedById(articleId);
    if (!record) {
      throw supportErrors.faqNotFound();
    }
    return toSupportFaqDetailResponse(record);
  }
}
