import type { z } from 'zod';
import type {
  legalDocumentsOverviewResponseSchema,
  legalDraftDetailResponseSchema,
  legalRequestDetailResponseSchema,
} from '@repo/shared/backoffice';

/** The backoffice API answers the legal screens draw (shared response schemas, parsed by the server read). */
export type LegalDraftDetail = z.infer<typeof legalDraftDetailResponseSchema>;
export type LegalRequestDetail = z.infer<typeof legalRequestDetailResponseSchema>;
export type LegalDocumentsOverview = z.infer<typeof legalDocumentsOverviewResponseSchema>;
