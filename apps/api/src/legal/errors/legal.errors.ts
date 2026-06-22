import { InternalServerErrorException } from '@nestjs/common';
import { createApiErrorBody, notFoundError } from '../../platform/http/api-error.js';

export const legalErrors = {
  documentNotFound() {
    return notFoundError('LEGAL_DOCUMENT_NOT_FOUND', '법적 문서를 찾을 수 없습니다.');
  },
  activeBundleIncomplete() {
    return new InternalServerErrorException(
      createApiErrorBody(
        'LEGAL_ACTIVE_DOCUMENT_BUNDLE_INCOMPLETE',
        '법적 문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      ),
    );
  },
} as const;
