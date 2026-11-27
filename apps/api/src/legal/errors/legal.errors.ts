import { InternalServerErrorException } from '@nestjs/common';
import {
  conflictError,
  createApiErrorBody,
  notFoundError,
  serviceUnavailableError,
} from '../../platform/http/api-error.js';

export const legalErrors = {
  documentNotFound() {
    return notFoundError('LEGAL_DOCUMENT_NOT_FOUND', '법적 문서를 찾을 수 없습니다.');
  },
  /** A version address that is malformed, unknown or withdrawn. */
  versionNotFound() {
    return notFoundError(
      'LEGAL_DOCUMENT_VERSION_NOT_FOUND',
      '해당 시행일의 문서를 찾을 수 없습니다.',
    );
  },
  /** The database could not be read and no published versions are held in memory yet. */
  documentsUnavailable() {
    return serviceUnavailableError(
      'LEGAL_DOCUMENTS_UNAVAILABLE',
      '법적 문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    );
  },
  activeBundleIncomplete() {
    return new InternalServerErrorException(
      createApiErrorBody(
        'LEGAL_ACTIVE_DOCUMENT_BUNDLE_INCOMPLETE',
        '법적 문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      ),
    );
  },
  /** A reconsent names a version that is not in effect or a kind the member does not owe. */
  consentStale() {
    return conflictError(
      'LEGAL_CONSENT_STALE',
      '동의할 문서가 바뀌었습니다. 최신 문서를 다시 확인해주세요.',
    );
  },
} as const;
