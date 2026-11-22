import type { BackofficeErrorCode } from '@repo/shared/backoffice';

/**
 * Error codes the BFF answers the page with: the backoffice API's codes passed through, plus the
 * BFF's own refusals. The page shows a fixed message per code (src/ui/error-messages.ts).
 */
export type BffErrorCode =
  | BackofficeErrorCode
  | 'forbidden_origin'
  | 'unsupported_media_type'
  | 'upstream_unavailable'
  | 'upstream_invalid';

export const BFF_ERROR_STATUS: Record<Exclude<BffErrorCode, BackofficeErrorCode>, number> = {
  forbidden_origin: 403,
  unsupported_media_type: 415,
  upstream_unavailable: 503,
  upstream_invalid: 502,
};

export interface BffErrorBody {
  readonly error: { readonly code: BffErrorCode };
}
