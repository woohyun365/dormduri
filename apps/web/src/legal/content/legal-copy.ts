import {
  LegalDocumentKind,
  type LegalDocumentKind as LegalDocumentKindValue,
} from '@repo/shared/legal';

export const LEGAL_DOCUMENT_ROUTE_LABELS = {
  [LegalDocumentKind.TERMS_OF_SERVICE]: {
    title: '이용약관',
    description: '돔두리 이용 조건과 서비스 운영 기준을 확인합니다.',
  },
  [LegalDocumentKind.PRIVACY_POLICY]: {
    title: '개인정보 처리방침',
    description: '돔두리가 개인정보를 처리하고 보호하는 기준을 확인합니다.',
  },
  [LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT]: {
    title: '개인정보 수집·이용 동의',
    description: '회원가입과 서비스 제공을 위한 필수 개인정보 수집·이용 기준을 확인합니다.',
  },
  [LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE]: {
    title: '만 14세 이상 확인',
    description: '돔두리 가입 가능 연령 기준을 확인합니다.',
  },
} satisfies Record<LegalDocumentKindValue, { title: string; description: string }>;

export const LEGAL_DOCUMENT_COPY = {
  unavailableTitle: '문서를 불러오지 못했습니다',
  unavailableDescription:
    '일시적으로 법적 문서를 확인할 수 없습니다. 잠시 후 다시 시도하거나 문의 채널로 알려주세요.',
  versionNotFoundTitle: '해당 시행일의 문서를 찾을 수 없습니다',
  versionNotFoundDescription:
    '주소의 시행일을 다시 확인하거나 지금 시행 중인 문서를 확인해 주세요.',
  currentDocumentLinkLabel: '지금 시행 중인 문서 보기',
  tableOfContentsLabel: '문서 목차',
  mobileTableOfContentsLabel: '문서 목차 먼저 보기',
  summaryLabel: '주요 내용',
  metadataVersionLabel: '시행본',
  metadataEffectiveLabel: '시행일',
  metadataUpdatedLabel: '최종 수정일',
  changeSummaryLabel: '변경 요약',
  actionsLabel: '문서 활용 도구',
  printActionLabel: '인쇄하기',
  copyLinkActionLabel: '링크 복사',
  copyLinkSuccessLabel: '현재 문서 링크를 복사했습니다.',
  copyLinkUnavailableLabel: '브라우저에서 링크 복사를 지원하지 않습니다.',
  homeLinkLabel: '돔두리 홈으로',
  backActionLabel: '이전 화면으로',
  backActionAriaLabel: '이전 화면으로 돌아가기',
} as const;

/** The notice above a document shown from this Web's last success of the request. */
export function legalLastSuccessNotice(checkedAtLabel: string): string {
  return `지금은 최신 문서를 확인할 수 없어 ${checkedAtLabel}에 마지막으로 확인한 문서를 보여드려요. 잠시 후 다시 확인해 주세요.`;
}
