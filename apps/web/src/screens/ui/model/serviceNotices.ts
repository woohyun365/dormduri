// The service notices more than one screen shows word for word: the independent-service notice and the
// public inquiry address (fe.ds.copy-authority). The Landing (its first screen and footer) and the Legal
// footer import them from here. Where each one comes from and which Landing surface must show it stay in
// the Landing policy copy (src/screens/landing/model/landingPolicyCopy.ts) and its README.

// docs/policies/service-boundary.md 면책 고지 시점: a legal boundary sentence, changed only with the
// Landing README notice rules.
export const serviceIndependentNotice = '돔두리는 학교 공식 서비스가 아닙니다.';

export const serviceInquiryLabel = '서비스 외부 문의';
// The inquiry address is text, not a link: the service's own mailbox, which the Owner set up for it
// (2026-10-27). The inquiry articles of the terms and the privacy policy name the same address.
export const serviceInquiryAddress = 'wooriduri.roommate@gmail.com';
