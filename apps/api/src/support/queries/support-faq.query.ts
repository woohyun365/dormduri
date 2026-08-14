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
    const records = await this.repository.listPublishedForSupportCenter({
      category: query.category,
    });
    return toSupportFaqListResponse(records);
  }

  async get(articleId: string): Promise<SupportFaqDetailResponse> {
    const record = await this.repository.findPublishedByIdForSupportCenter(articleId);
    if (!record) {
      throw supportErrors.faqNotFound();
    }
    return toSupportFaqDetailResponse(record);
  }
}
