import { badRequestError, notFoundError } from '../../../platform/http/api-error.js';

export const reportErrors = {
  invalidReportRequest() {
    return badRequestError('INVALID_REPORT_REQUEST', '신고 요청 본문이 올바르지 않습니다.');
  },

  targetNotReportable() {
    return notFoundError('REPORT_TARGET_NOT_REPORTABLE', '신고할 수 없는 대상입니다.');
  },

  targetNotSupported() {
    return badRequestError('REPORT_TARGET_NOT_SUPPORTED', '아직 지원하지 않는 신고 대상입니다.');
  },
};
