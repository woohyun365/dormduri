import { describe, expect, it } from 'vitest';
import {
  LegalAcceptanceAction,
  LegalDocumentKind,
  activeLegalDocumentsBundleResponseSchema,
  legalAcceptanceActionSchema,
  legalDocumentKindSchema,
  legalDocumentResponseSchema,
  signupLegalAcceptancesSchema,
} from '@repo/shared/legal';
import { legalDocumentSectionSchema } from '@repo/shared/legal/contract';

function legalDocument(kind: LegalDocumentKind, version: string) {
  return {
    id: `${kind.toLowerCase()}-${version}`,
    kind,
    version,
    title: `${kind} 문서`,
    effectiveAt: '2026-06-22T00:00:00.000Z',
    lastModifiedAt: '2026-06-22T00:00:00.000Z',
    summaryItems: ['회원가입 전에 확인해야 하는 필수 법적 고지입니다.'],
    sections: [
      { type: 'heading', level: 2, text: '문서 개요' },
      { type: 'paragraph', text: '서비스 이용과 개인정보 처리에 필요한 고지입니다.' },
      { type: 'list', items: ['운영 주체', '수집 항목', '보유 기간'] },
      {
        type: 'table',
        headers: ['구분', '내용'],
        rows: [['보유 기간', '회원 탈퇴 및 법령상 보존 기간까지']],
      },
      { type: 'callout', tone: 'INFO', text: '필수 동의 항목은 가입에 필요합니다.' },
    ],
    changeSummary: '최초 문서 버전입니다.',
  } as const;
}

describe('legal shared contract', () => {
  it('legal document kind와 acceptance action은 가입 legal surface의 허용 값만 제공한다', () => {
    expect(legalDocumentKindSchema.parse('TERMS_OF_SERVICE')).toBe(
      LegalDocumentKind.TERMS_OF_SERVICE,
    );
    expect(legalDocumentKindSchema.parse('PRIVACY_POLICY')).toBe(LegalDocumentKind.PRIVACY_POLICY);
    expect(legalDocumentKindSchema.parse('PERSONAL_DATA_COLLECTION_USE_CONSENT')).toBe(
      LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
    );
    expect(legalDocumentKindSchema.parse('AGE_14_OR_ABOVE_NOTICE')).toBe(
      LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
    );
    expect(legalDocumentKindSchema.safeParse('MARKETING_CONSENT').success).toBe(false);

    expect(legalAcceptanceActionSchema.parse('AGREE')).toBe(LegalAcceptanceAction.AGREE);
    expect(legalAcceptanceActionSchema.parse('SHOW')).toBe(LegalAcceptanceAction.SHOW);
    expect(legalAcceptanceActionSchema.safeParse('CHECKED').success).toBe(false);
  });

  it('public legal document response는 typed section만 허용하고 raw HTML/admin/draft field를 거부한다', () => {
    const document = legalDocument(LegalDocumentKind.PRIVACY_POLICY, 'privacy-2026-06-22');

    expect(legalDocumentResponseSchema.parse(document)).toMatchObject({
      kind: LegalDocumentKind.PRIVACY_POLICY,
      version: 'privacy-2026-06-22',
    });

    expect(
      legalDocumentSectionSchema.safeParse({ type: 'paragraph', html: '<b>raw</b>' }).success,
    ).toBe(false);
    expect(legalDocumentResponseSchema.safeParse({ ...document, html: '<script />' }).success).toBe(
      false,
    );
    expect(
      legalDocumentResponseSchema.safeParse({ ...document, adminNotes: '내부 검수 메모' }).success,
    ).toBe(false);
    expect(legalDocumentResponseSchema.safeParse({ ...document, draft: true }).success).toBe(false);
    expect(
      legalDocumentResponseSchema.safeParse({
        ...document,
        sections: [{ type: 'html', value: '<script>alert(1)</script>' }],
      }).success,
    ).toBe(false);
  });

  it('active legal bundle은 signup에 필요한 네 종류의 active document를 모두 요구한다', () => {
    const bundle = {
      termsOfService: legalDocument(LegalDocumentKind.TERMS_OF_SERVICE, 'terms-2026-06-22'),
      privacyPolicy: legalDocument(LegalDocumentKind.PRIVACY_POLICY, 'privacy-2026-06-22'),
      personalDataCollectionUseConsent: legalDocument(
        LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        'collection-use-2026-06-22',
      ),
      age14OrAboveNotice: legalDocument(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE, 'age-2026-06-22'),
    } as const;

    expect(activeLegalDocumentsBundleResponseSchema.parse(bundle)).toMatchObject({
      termsOfService: { kind: LegalDocumentKind.TERMS_OF_SERVICE },
      privacyPolicy: { kind: LegalDocumentKind.PRIVACY_POLICY },
    });
    expect(
      activeLegalDocumentsBundleResponseSchema.safeParse({
        ...bundle,
        age14OrAboveNotice: undefined,
      }).success,
    ).toBe(false);
    expect(
      activeLegalDocumentsBundleResponseSchema.safeParse({
        ...bundle,
        privacyPolicy: legalDocument(LegalDocumentKind.TERMS_OF_SERVICE, 'terms-2026-06-22'),
      }).success,
    ).toBe(false);
  });

  it('signup legal acceptance는 동의 version id와 개인정보 처리방침 표시 evidence id를 분리한다', () => {
    expect(
      signupLegalAcceptancesSchema.parse({
        termsVersionId: 'terms-2026-06-22',
        personalDataConsentVersionId: 'collection-use-2026-06-22',
        ageNoticeVersionId: 'age-2026-06-22',
        privacyPolicyVersionIdShown: 'privacy-2026-06-22',
      }),
    ).toMatchObject({
      personalDataConsentVersionId: 'collection-use-2026-06-22',
      privacyPolicyVersionIdShown: 'privacy-2026-06-22',
    });

    expect(
      signupLegalAcceptancesSchema.safeParse({
        termsVersionId: 'terms-2026-06-22',
        personalDataConsentVersionId: '',
        ageNoticeVersionId: 'age-2026-06-22',
        privacyPolicyVersionIdShown: 'privacy-2026-06-22',
      }).success,
    ).toBe(false);
  });
});
