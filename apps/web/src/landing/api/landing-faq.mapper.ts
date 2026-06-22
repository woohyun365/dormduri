import type { SupportFaqItem } from '@repo/shared/support';
import type { LandingFallbackFaqItem } from '../content/landing-content.types';

export type LandingFaqSource = 'support_api' | 'emergency_fallback';

export type LandingFaqViewModel = Readonly<{
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  source: LandingFaqSource;
}>;

export function mapSupportFaqItemToLandingFaq(item: SupportFaqItem): LandingFaqViewModel {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder,
    source: 'support_api',
  };
}

export function mapFallbackFaqItemToLandingFaq(item: LandingFallbackFaqItem): LandingFaqViewModel {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder,
    source: 'emergency_fallback',
  };
}
