import type { LegalDocument } from './types';
import { TERMS_OF_SERVICE } from './terms';
import { PRIVACY_POLICY } from './privacy';

export type { LegalDocument };

export const TERMS_CONTENT: Record<'terms' | 'privacy', LegalDocument> = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
};
