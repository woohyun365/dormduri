import type {
  AccountListResponse,
  LegalBackofficeVersion,
  LegalBackofficeVersionDetail,
  LegalDraft,
  LegalRequest,
} from '@repo/shared/backoffice';
import type { LegalArticleComparison, LegalDocumentSection } from '@repo/shared/legal';
import type {
  LegalDocumentsOverview,
  LegalDraftDetail,
  LegalRequestDetail,
} from '../../screens/legal/legal-types';
import { AUDITOR_ID, OWNER_ID, accountList } from './fixtures';

// Legal story fixtures (design guide ⑨): made-up document text and fixed UUIDs whose first eight characters differ.
// Seed version ids are kind-date slugs, as in the development seed.

const SCHEDULED_ID = '9a1b2c3d-0000-4000-8000-00000000a001';
const DRAFT_ID = 'a2b3c4d5-0000-4000-8000-00000000b001';
const FIRST_DRAFT_ID = 'b3c4d5e6-0000-4000-8000-00000000b002';
const PENDING_DRAFT_ID = 'c4d5e6f7-0000-4000-8000-00000000b003';
const PUBLISHED_DRAFT_ID = 'd5e6f708-0000-4000-8000-00000000b004';
const DISCARDED_DRAFT_ID = 'e6f70819-0000-4000-8000-00000000b005';
const PUBLISH_REQUEST_ID = 'f708192a-0000-4000-8000-00000000c001';
const WITHDRAW_REQUEST_ID = '08192a3b-0000-4000-8000-00000000c002';
const APPROVED_REQUEST_ID = '192a3b4c-0000-4000-8000-00000000c003';

export const legalBeforeSections: LegalDocumentSection[] = [
  { type: 'paragraph', text: '이 처리방침은 시험 서비스가 개인정보를 어떻게 다루는지 설명합니다.' },
  { type: 'heading', level: 2, text: '제1조(처리 목적)' },
  { type: 'paragraph', text: '회원 가입과 룸메이트 매칭을 위해 개인정보를 처리합니다.' },
  { type: 'heading', level: 2, text: '제2조(보유 기간)' },
  {
    type: 'table',
    caption: '항목별 보유 기간',
    headers: ['항목', '보유 기간'],
    rows: [
      ['회원 정보', '탈퇴할 때까지'],
      ['접속 기록', '3개월'],
    ],
  },
  { type: 'heading', level: 2, text: '제3조(문의)' },
  { type: 'paragraph', text: '개인정보 문의는 privacy@example.test로 보냅니다.' },
];

export const legalAfterSections: LegalDocumentSection[] = [
  { type: 'paragraph', text: '이 처리방침은 시험 서비스가 개인정보를 어떻게 다루는지 설명합니다.' },
  { type: 'heading', level: 2, text: '제1조(처리 목적)' },
  { type: 'paragraph', text: '회원 가입과 룸메이트 매칭을 위해 개인정보를 처리합니다.' },
  { type: 'heading', level: 2, text: '제2조(보유 기간)' },
  {
    type: 'table',
    caption: '항목별 보유 기간',
    headers: ['항목', '보유 기간', '근거'],
    rows: [
      ['회원 정보', '탈퇴할 때까지', '서비스 이용'],
      ['접속 기록', '3년', '내부 감사 규정'],
    ],
  },
  { type: 'callout', tone: 'WARNING', text: '보유 기간이 지난 기록은 지체 없이 파기합니다.' },
  { type: 'heading', level: 2, text: '제3조(처리 위탁)' },
  {
    type: 'list',
    ordered: true,
    items: ['데이터베이스 운영: 시험 클라우드', '메일 발송: 시험 메일'],
  },
];

export const legalComparison: LegalArticleComparison[] = [
  {
    heading: null,
    change: 'unchanged',
    before: legalBeforeSections.slice(0, 1),
    after: legalAfterSections.slice(0, 1),
  },
  {
    heading: '제1조(처리 목적)',
    change: 'unchanged',
    before: legalBeforeSections.slice(1, 3),
    after: legalAfterSections.slice(1, 3),
  },
  {
    heading: '제2조(보유 기간)',
    change: 'changed',
    before: legalBeforeSections.slice(3, 5),
    after: legalAfterSections.slice(3, 6),
  },
  { heading: '제3조(문의)', change: 'removed', before: legalBeforeSections.slice(5), after: [] },
  { heading: '제3조(처리 위탁)', change: 'added', before: [], after: legalAfterSections.slice(6) },
];

const currentPrivacy: LegalBackofficeVersion = {
  id: 'privacy-policy-2026-06-22',
  kind: 'PRIVACY_POLICY',
  version: 'privacy-policy-2026-06-22',
  title: '개인정보 처리방침',
  changeSummary: '첫 게시',
  noticeClass: 'INITIAL',
  consentRequired: false,
  effectiveDate: '2026-11-20',
  appliesUntil: null,
  contentDigest: '1'.repeat(64),
  publishedAt: '2026-11-26T10:00:00+09:00',
  withdrawnAt: null,
  requestedByAccountId: OWNER_ID,
  approvedByAccountId: OWNER_ID,
  selfApproved: true,
};

export const legalScheduledVersion: LegalBackofficeVersionDetail = {
  id: SCHEDULED_ID,
  kind: 'PRIVACY_POLICY',
  version: SCHEDULED_ID,
  title: '개인정보 처리방침',
  changeSummary: '접속 기록 보유 기간을 3년으로 바꾸고 처리 위탁 조항을 더합니다.',
  noticeClass: 'GENERAL',
  consentRequired: false,
  effectiveDate: '2026-12-10',
  appliesUntil: null,
  contentDigest: '2'.repeat(64),
  publishedAt: '2026-11-26T11:00:00+09:00',
  withdrawnAt: null,
  requestedByAccountId: OWNER_ID,
  approvedByAccountId: AUDITOR_ID,
  selfApproved: false,
  contentSchemaVersion: 1,
  summaryItems: ['접속 기록을 3년 보관합니다.', '처리 위탁 업체를 적습니다.'],
  sections: legalAfterSections,
};

export const legalHistoricalVersion: LegalBackofficeVersionDetail = {
  ...legalScheduledVersion,
  id: 'privacy-policy-historical-2026-06-22',
  version: 'privacy-policy-historical-2026-06-22',
  changeSummary: '이전 판 기록',
  noticeClass: 'HISTORICAL',
  effectiveDate: '2026-06-22',
  appliesUntil: '2026-11-19',
  contentDigest: '3'.repeat(64),
  approvedByAccountId: OWNER_ID,
  selfApproved: true,
  summaryItems: [],
  sections: legalBeforeSections,
};

const firstPublication = (
  kind: LegalBackofficeVersion['kind'],
  title: string,
): LegalBackofficeVersion => ({
  ...currentPrivacy,
  id: `${kind.toLowerCase().replaceAll('_', '-')}-2026-06-22`,
  version: `${kind.toLowerCase().replaceAll('_', '-')}-2026-06-22`,
  kind,
  title,
  effectiveDate: '2026-06-22',
  contentDigest: '4'.repeat(64),
});

/** Three kinds with versions; the age notice has none yet, so the API leaves it out. */
export const legalOverview: LegalDocumentsOverview = {
  documents: [
    {
      kind: 'PRIVACY_POLICY',
      versions: [
        { ...legalScheduledVersion, state: 'scheduled' },
        { ...currentPrivacy, state: 'current' },
        { ...legalHistoricalVersion, state: 'previous' },
      ],
    },
    {
      kind: 'TERMS_OF_SERVICE',
      versions: [{ ...firstPublication('TERMS_OF_SERVICE', '이용약관'), state: 'current' }],
    },
    {
      kind: 'PERSONAL_DATA_COLLECTION_USE_CONSENT',
      versions: [
        {
          ...firstPublication('PERSONAL_DATA_COLLECTION_USE_CONSENT', '개인정보 수집·이용 동의'),
          state: 'current',
        },
      ],
    },
  ],
};

/** A privacy policy with a long history: a withdrawn version and twelve earlier ones. */
export const legalOverviewMany: LegalDocumentsOverview = {
  documents: [
    {
      kind: 'PRIVACY_POLICY',
      versions: [
        { ...legalScheduledVersion, state: 'scheduled' },
        {
          ...legalScheduledVersion,
          id: '2a3b4c5d-0000-4000-8000-00000000a002',
          effectiveDate: '2026-12-01',
          withdrawnAt: '2026-11-25T16:00:00+09:00',
          state: 'withdrawn',
        },
        { ...currentPrivacy, state: 'current' },
        ...Array.from({ length: 12 }, (_, index) => {
          const month = String(12 - index).padStart(2, '0');
          return {
            ...currentPrivacy,
            id: `3b4c5d6e-0000-4000-8000-0000000a10${String(index).padStart(2, '0')}`,
            noticeClass: 'GENERAL' as const,
            effectiveDate: `2025-${month}-01`,
            selfApproved: index % 4 === 0,
            state: 'previous' as const,
          };
        }),
      ],
    },
  ],
};

const baseDraft: LegalDraft = {
  id: DRAFT_ID,
  kind: 'PRIVACY_POLICY',
  status: 'EDITING',
  revision: 3,
  basedOnVersionId: 'privacy-policy-2026-06-22',
  authorAccountId: OWNER_ID,
  content: {
    kind: 'PRIVACY_POLICY',
    contentSchemaVersion: 1,
    title: '개인정보 처리방침',
    summaryItems: ['접속 기록을 3년 보관합니다.', '처리 위탁 업체를 적습니다.'],
    sections: legalAfterSections,
    changeSummary: '접속 기록 보유 기간을 3년으로 바꾸고 처리 위탁 조항을 더합니다.',
    noticeClass: 'GENERAL',
    consentRequired: false,
    proposedEffectiveDate: '2026-12-10',
    appliesUntil: null,
  },
  contentDigest: '5'.repeat(64),
  createdAt: '2026-11-26T09:00:00+09:00',
  updatedAt: '2026-11-26T09:40:00+09:00',
};

const previousPrivacy: LegalBackofficeVersion = currentPrivacy;

export const legalDraftDetail: LegalDraftDetail = {
  draft: baseDraft,
  previousVersion: previousPrivacy,
  comparison: legalComparison,
};

/** A first publication imported from the seed export: nothing comes before it. */
export const legalFirstDraftDetail: LegalDraftDetail = {
  draft: {
    ...baseDraft,
    id: FIRST_DRAFT_ID,
    kind: 'AGE_14_OR_ABOVE_NOTICE',
    revision: 1,
    basedOnVersionId: null,
    content: {
      kind: 'AGE_14_OR_ABOVE_NOTICE',
      contentSchemaVersion: 1,
      title: '만 14세 이상 확인',
      summaryItems: [],
      sections: [{ type: 'paragraph', text: '만 14세 이상만 가입할 수 있습니다.' }],
      changeSummary: '첫 게시',
      noticeClass: 'INITIAL',
      consentRequired: false,
      proposedEffectiveDate: '2026-06-22',
      appliesUntil: null,
    },
  },
  previousVersion: null,
  comparison: [],
};

export const legalPendingDraftDetail: LegalDraftDetail = {
  ...legalDraftDetail,
  draft: { ...baseDraft, id: PENDING_DRAFT_ID, status: 'PENDING_APPROVAL' },
};

/** A long title and a body of thirty sections, as a long policy reads. */
export const legalLongDraftDetail: LegalDraftDetail = {
  ...legalDraftDetail,
  draft: {
    ...baseDraft,
    content: {
      ...baseDraft.content,
      title: '룸메이트매칭서비스개인정보처리방침및위치정보이용약관통합본시험판',
      sections: Array.from({ length: 10 }, (_, index) => [
        {
          type: 'heading' as const,
          level: 2 as const,
          text: `제${index + 1}조(시험 조항 ${index + 1})`,
        },
        {
          type: 'paragraph' as const,
          text: '아주긴붙은낱말이줄을넘을때도화면이가로로넘치지않는지보는시험문단입니다. '.repeat(
            3,
          ),
        },
        { type: 'list' as const, ordered: false, items: ['첫째 항목', '둘째 항목'] },
      ]).flat(),
    },
  },
};

export const legalDrafts: LegalDraft[] = [
  baseDraft,
  {
    ...baseDraft,
    id: PENDING_DRAFT_ID,
    status: 'PENDING_APPROVAL',
    updatedAt: '2026-11-25T18:00:00+09:00',
  },
  {
    ...legalFirstDraftDetail.draft,
    id: PUBLISHED_DRAFT_ID,
    status: 'PUBLISHED',
    authorAccountId: AUDITOR_ID,
    updatedAt: '2026-11-24T12:00:00+09:00',
  },
  {
    ...baseDraft,
    id: DISCARDED_DRAFT_ID,
    status: 'DISCARDED',
    content: {
      ...baseDraft.content,
      title: '룸메이트매칭서비스개인정보처리방침및위치정보이용약관통합본시험판',
    },
    updatedAt: '2026-11-23T08:30:00+09:00',
  },
];

const LONG_AUTHOR_ID = '7d8e9fa0-0000-4000-8000-00000000a0a1';

/** The accounts plus one whose name is 80 characters without a space, the invite maximum (design guide ⑦ name column). */
export const legalLongAuthorAccountList: AccountListResponse = {
  ...accountList,
  accounts: [
    ...accountList.accounts,
    {
      id: LONG_AUTHOR_ID,
      email: 'legal-long-author@example.test',
      displayName: `${'법적문서편집담당운영자'.repeat(7)}한빛나`,
      status: 'ACTIVE',
      locked: false,
      roles: ['LEGAL_EDITOR'],
      lastLoginAt: '2026-11-25T09:00:00+09:00',
      deactivatedAt: null,
      createdAt: '2026-11-04T10:00:00+09:00',
    },
  ],
};

/** The drafts with the first one written by that operator. */
export const legalLongAuthorDrafts: LegalDraft[] = [
  { ...baseDraft, authorAccountId: LONG_AUTHOR_ID },
  ...legalDrafts.slice(1),
];

/** Fifty drafts for the row height. */
export const manyLegalDrafts: LegalDraft[] = Array.from({ length: 50 }, (_, index) => {
  const n = String(index + 1).padStart(2, '0');
  return {
    ...baseDraft,
    id: `4c5d6e7f-0000-4000-8000-0000000b10${n}`,
    status: (['EDITING', 'PENDING_APPROVAL', 'PUBLISHED', 'DISCARDED'] as const)[index % 4]!,
    content: { ...baseDraft.content, title: `개인정보 처리방침 시험 초안 ${n}` },
    updatedAt: `2026-11-${String(26 - (index % 20)).padStart(2, '0')}T09:${n}:00+09:00`,
  };
});

const baseRequest: LegalRequest = {
  id: PUBLISH_REQUEST_ID,
  kind: 'LEGAL_PUBLISH',
  status: 'PENDING',
  contentDigest: '5'.repeat(64),
  targetLegalDraftId: PENDING_DRAFT_ID,
  targetLegalVersionId: null,
  requestedByAccountId: AUDITOR_ID,
  requestReason: '보유 기간 표를 고칩니다.',
  expiresAt: '2026-12-03T09:00:00+09:00',
  decidedByAccountId: null,
  closedAt: null,
  decisionReason: null,
  selfApproved: false,
  createdAt: '2026-11-26T09:00:00+09:00',
};

export const legalRequests: LegalRequest[] = [
  baseRequest,
  {
    ...baseRequest,
    id: WITHDRAW_REQUEST_ID,
    kind: 'LEGAL_WITHDRAW',
    contentDigest: '2'.repeat(64),
    targetLegalDraftId: null,
    targetLegalVersionId: SCHEDULED_ID,
    requestedByAccountId: OWNER_ID,
    requestReason: '시행일을 다시 정합니다.',
    createdAt: '2026-11-26T08:00:00+09:00',
  },
];

export const decidedLegalRequests: LegalRequest[] = [
  {
    ...baseRequest,
    id: APPROVED_REQUEST_ID,
    status: 'APPROVED',
    requestedByAccountId: OWNER_ID,
    decidedByAccountId: OWNER_ID,
    closedAt: '2026-11-26T10:00:00+09:00',
    decisionReason: '승인 권한 운영자가 한 명뿐이라 자기 승인합니다.',
    selfApproved: true,
  },
];

const pendingDraft = legalPendingDraftDetail.draft;

/** Another operator's publish request with the comparison and the checks passing. */
export const legalRequestDetail: LegalRequestDetail = {
  request: baseRequest,
  draft: pendingDraft,
  version: null,
  previousVersion: previousPrivacy,
  comparison: legalComparison,
  check: { ok: true },
};

/** The viewer's own request while they are the only approver. */
export const legalSelfRequestDetail: LegalRequestDetail = {
  ...legalRequestDetail,
  request: { ...baseRequest, requestedByAccountId: OWNER_ID },
};

export const legalFirstRequestDetail: LegalRequestDetail = {
  request: { ...baseRequest, targetLegalDraftId: FIRST_DRAFT_ID, requestReason: null },
  draft: { ...legalFirstDraftDetail.draft, status: 'PENDING_APPROVAL' },
  version: null,
  previousVersion: null,
  comparison: [],
  check: { ok: true },
};

export const legalRefusedRequestDetail: LegalRequestDetail = {
  ...legalRequestDetail,
  check: { ok: false, reason: 'notice_too_short' },
};

export const legalWithdrawRequestDetail: LegalRequestDetail = {
  request: legalRequests[1]!,
  draft: null,
  version: legalScheduledVersion,
  previousVersion: previousPrivacy,
  comparison: legalComparison,
  check: { ok: true },
};

export const legalClosedRequestDetail: LegalRequestDetail = {
  request: decidedLegalRequests[0]!,
  draft: { ...pendingDraft, status: 'PUBLISHED' },
  version: null,
  previousVersion: previousPrivacy,
  comparison: legalComparison,
  check: null,
};

export const legalDecision = {
  request: { ...baseRequest, status: 'APPROVED', decidedByAccountId: OWNER_ID },
  version: legalScheduledVersion,
} as const;
