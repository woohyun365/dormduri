// Type-only import: the Legal e2e imports this copy, and the Playwright loader cannot load the
// @repo/shared build (e2e/support/legal-last-success-fixture.ts).
import type { PublicLegalDocumentKind } from '../../ui/model/legalAddress';
import {
  serviceIndependentNotice,
  serviceInquiryAddress,
  serviceInquiryLabel,
} from '../../ui/model/serviceNotices';

// The legal screens' own copy: titles around the document, action names, notices. The document body
// itself comes from the published version and is never written here (G-LU1). User copy names no plan,
// issue, internal path, raw id or internal state (G-LU10). The words are 합니다체 like the documents
// themselves (fe.ds.copy-style, the legal screen exception; screens/legal/README.md).

export const legalDocumentNames = {
  TERMS_OF_SERVICE: '이용약관',
  // The name the law gives it, with the space (docs/policies/legal-basis.md LB-R1).
  PRIVACY_POLICY: '개인정보 처리방침',
} satisfies Record<PublicLegalDocumentKind, string>;

export const legalDocumentIntros = {
  TERMS_OF_SERVICE: '돔두리 이용 조건과 서비스 운영 기준을 확인합니다.',
  PRIVACY_POLICY: '돔두리가 개인정보를 처리하고 보호하는 기준을 확인합니다.',
} satisfies Record<PublicLegalDocumentKind, string>;

export const legalScreenCopy = {
  homeLabel: '돔두리 홈으로',
  backLabel: '이전 화면으로',
  documentNavLabel: '문서',
  summaryLabel: '주요 내용',
  effectiveLabel: '시행일',
  lastModifiedLabel: '최종 수정일',
  changeSummaryLabel: '변경 요약',
  tocLabel: '목차',
  actionsLabel: '문서 도구',
  printLabel: '인쇄하기',
  copyLinkLabel: '링크 복사',
  copyLinkDone: '현재 문서 링크를 복사했습니다.',
  copyLinkUnavailable:
    '이 브라우저에서는 링크 복사를 쓸 수 없습니다. 주소창의 주소를 복사해 주세요.',
  noticeLabel: { INFO: '안내', WARNING: '주의' },
  // A copy this server kept from the last answer of the public reading API: what is shown, then when it
  // was checked under its own label (two short lines, Owner 2026-11-26).
  lastSuccessNotice: '최신 판을 확인할 수 없어 마지막으로 확인한 판을 보여 드립니다.',
  checkedAtLabel: '확인 시각',
  versionsTitle: '적용 기간과 이전 판',
  versionStatusLabel: {
    scheduled: '시행 예정 판',
    current: '지금 적용하는 판',
    previous: '이전 판',
  },
  viewingVersionLabel: '지금 보는 판',
  viewVersionLabel: '보기',
  scheduledLabel: '새 판 공지',
  scheduledNotice: (date: string, name: string) =>
    `${date}부터 적용하는 새 ${name}이 공지되어 있습니다.`,
  scheduledLinkLabel: '새 판 미리 보기',
  // A sentence per line after the label (Owner 2026-11-26).
  viewingScheduledNotice: (date: string) => [
    `이 판은 ${date}부터 적용합니다.`,
    '그 전까지는 지금 적용하는 판이 효력을 가집니다.',
  ],
  viewingPreviousNotice: (from: string, to: string) => [
    `이 판은 ${from}부터 ${to}까지 적용한 판입니다.`,
    '지금 적용하는 판이 아닙니다.',
  ],
  viewCurrentVersionLabel: '지금 판 보기',
  comparisonTitle: '이전 판과 달라진 조항',
  comparisonLinkLabel: '달라진 조항 보기',
  articleChangeLabel: { added: '더함', removed: '뺌', changed: '바뀜' },
  comparisonBeforeLabel: '이전 판',
  comparisonAfterLabel: '이 판',
  comparisonEmptyLabel: '없음',
  comparisonPreambleLabel: '첫 조 앞의 글',
  comparisonUnchanged: '조항 글은 이전 판과 같습니다.',
  comparisonUnavailable:
    '지금은 이전 판과의 대조표를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.',
  unavailableTitleSuffix: '을 지금 표시할 수 없습니다',
  unavailableDescription: '일시적인 문제로 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  unavailableRetryLabel: '다시 시도',
  homeActionLabel: '홈으로',
  contactLead: '계속 열리지 않으면 서비스 외부 문의 주소로 알려 주세요.',
  versionNotFoundTitleSuffix: '에서 이 판을 찾을 수 없습니다',
  versionNotFoundDescription:
    '주소의 시행일에 해당하는 판이 없습니다. 지금 적용하는 판을 확인해 주세요.',
  versionNotFoundContactLead: '찾는 판이 있었다면 서비스 외부 문의 주소로 알려 주세요.',
} as const;

// The legal shell's footer line: the public inquiry address and the independent-service notice, the
// same words the landing shows (one source, screens/ui/model/serviceNotices.ts).
export const legalShellCopy = {
  inquiryLabel: serviceInquiryLabel,
  inquiryAddress: serviceInquiryAddress,
  independentNotice: serviceIndependentNotice,
} as const;
