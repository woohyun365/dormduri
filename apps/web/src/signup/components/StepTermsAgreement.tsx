'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  ActiveLegalDocumentsBundleResponse,
  LegalDocumentResponse,
  SignupLegalAcceptances,
} from '@repo/shared/legal';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { FieldError } from '@/components/form/FieldError';
import { getSignupLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';
import { LegalConsentSummaryCard } from '@/legal/components/LegalConsentSummaryCard';
import { LegalDocumentDialog } from '@/legal/components/LegalDocumentDialog';
import { FileText } from 'lucide-react';

export interface TermsData {
  agreeAge: boolean;
  agreeTerms: boolean;
  agreePersonalDataCollectionUse: boolean;
  legalAcceptances?: SignupLegalAcceptances;
  legalBundleSource?: 'api' | 'fallback';
  /** @deprecated signup draft compatibility for the previous privacy-policy consent field. */
  agreePrivacy?: boolean;
}

interface StepTermsAgreementProps {
  terms: TermsData;
  onTermsChange: (terms: TermsData) => void;
  onNext: () => void;
  onBack: () => void;
  refreshNonce?: number;
  notice?: string;
}

function toLegalAcceptances(bundle: ActiveLegalDocumentsBundleResponse): SignupLegalAcceptances {
  return {
    termsVersionId: bundle.termsOfService.id,
    personalDataConsentVersionId: bundle.personalDataCollectionUseConsent.id,
    ageNoticeVersionId: bundle.age14OrAboveNotice.id,
    privacyPolicyVersionIdShown: bundle.privacyPolicy.id,
  };
}

function sameLegalAcceptances(
  left: SignupLegalAcceptances | undefined,
  right: SignupLegalAcceptances,
): boolean {
  if (!left) return false;

  return (
    left.termsVersionId === right.termsVersionId &&
    left.personalDataConsentVersionId === right.personalDataConsentVersionId &&
    left.ageNoticeVersionId === right.ageNoticeVersionId &&
    left.privacyPolicyVersionIdShown === right.privacyPolicyVersionIdShown
  );
}

function normalizeTerms(terms: TermsData): TermsData {
  return {
    agreeAge: terms.agreeAge,
    agreeTerms: terms.agreeTerms,
    agreePersonalDataCollectionUse:
      terms.agreePersonalDataCollectionUse ?? terms.agreePrivacy ?? false,
    ...(terms.legalAcceptances ? { legalAcceptances: terms.legalAcceptances } : {}),
    ...(terms.legalBundleSource ? { legalBundleSource: terms.legalBundleSource } : {}),
  };
}

export function StepTermsAgreement({
  terms,
  onTermsChange,
  onNext,
  onBack,
  refreshNonce = 0,
  notice,
}: StepTermsAgreementProps) {
  const [error, setError] = useState('');
  const [bundleState, setBundleState] = useState<
    | { status: 'loading' }
    | {
        status: 'ready';
        source: 'api' | 'fallback';
        bundle: ActiveLegalDocumentsBundleResponse;
      }
  >({ status: 'loading' });
  const [viewingDocument, setViewingDocument] = useState<LegalDocumentResponse | null>(null);
  const termsRef = useRef(terms);

  useEffect(() => {
    termsRef.current = terms;
  }, [terms]);

  useEffect(() => {
    let cancelled = false;

    getSignupLegalDocumentsBundle().then((result) => {
      if (cancelled) return;

      const nextAcceptances = toLegalAcceptances(result.bundle);
      const currentTerms = normalizeTerms(termsRef.current);
      const shouldResetChecks =
        currentTerms.legalAcceptances !== undefined &&
        !sameLegalAcceptances(currentTerms.legalAcceptances, nextAcceptances);

      onTermsChange({
        agreeAge: shouldResetChecks ? false : currentTerms.agreeAge,
        agreeTerms: shouldResetChecks ? false : currentTerms.agreeTerms,
        agreePersonalDataCollectionUse: shouldResetChecks
          ? false
          : currentTerms.agreePersonalDataCollectionUse,
        legalAcceptances: nextAcceptances,
        legalBundleSource: result.source,
      });
      setBundleState({ status: 'ready', source: result.source, bundle: result.bundle });
    });

    return () => {
      cancelled = true;
    };
  }, [onTermsChange, refreshNonce]);

  const normalizedTerms = normalizeTerms(terms);
  const allAgreed =
    normalizedTerms.agreeAge &&
    normalizedTerms.agreeTerms &&
    normalizedTerms.agreePersonalDataCollectionUse;

  const handleAllAgree = (checked: boolean) => {
    onTermsChange({
      ...normalizedTerms,
      agreeAge: checked,
      agreeTerms: checked,
      agreePersonalDataCollectionUse: checked,
    });
    if (checked) setError('');
  };

  const handleNext = () => {
    if (!allAgreed) {
      setError('필수 확인·동의 항목을 모두 체크해주세요.');
      return;
    }
    if (!normalizedTerms.legalAcceptances) {
      setError('최신 약관 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<FileText className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="약관 동의"
        description="서비스 이용을 위한 약관에 동의해주세요"
      />

      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {bundleState.status === 'loading' ? (
          <div role="status" className="rounded-2xl bg-(--knu-background-alt) p-5 text-sm">
            최신 약관 정보를 불러오는 중입니다.
          </div>
        ) : (
          <LegalConsentSummaryCard
            checks={{
              agreeAge: normalizedTerms.agreeAge,
              agreeTerms: normalizedTerms.agreeTerms,
              agreePersonalDataCollectionUse: normalizedTerms.agreePersonalDataCollectionUse,
            }}
            bundle={bundleState.bundle}
            source={bundleState.source}
            onToggleAll={handleAllAgree}
            onToggle={(field, checked) => {
              onTermsChange({ ...normalizedTerms, [field]: checked });
              if (checked) setError('');
            }}
            onOpenDocument={setViewingDocument}
          />
        )}

        <FieldError message={error} />

        <p className="text-xs text-[var(--knu-text-tertiary)] mt-2 keep-all">
          본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다. 약관의 운영 주체는
          강원대학교가 아닌 서비스 운영자 개인입니다.
        </p>
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        disabled={bundleState.status === 'loading'}
      />

      {viewingDocument && (
        <LegalDocumentDialog document={viewingDocument} onClose={() => setViewingDocument(null)} />
      )}
    </div>
  );
}
