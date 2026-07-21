'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  ActiveLegalDocumentsBundleResponse,
  LegalDocumentResponse,
  SignupLegalAcceptances,
} from '@repo/shared/legal';
import { StepHeader } from '@/auth/components/StepHeader';
import { StepNavigation } from './StepNavigation';
import { FieldError } from '@/auth/components/form/FieldError';
import { getSignupLegalDocumentsBundle } from '@/legal/api/legal-documents-bundle.api';
import { LegalConsentSummaryCard } from '@/legal/components/LegalConsentSummaryCard';
import { LegalDocumentDialog } from '@/legal/components/LegalDocumentDialog';
import { FileText } from 'lucide-react';

export interface LegalConsentData {
  agreeAge: boolean;
  agreeTerms: boolean;
  agreePersonalDataCollectionUse: boolean;
  legalAcceptances?: SignupLegalAcceptances;
  legalBundleSource?: 'api' | 'fallback';
}

interface LegalConsentStepProps {
  legalConsent: LegalConsentData;
  onLegalConsentChange: (legalConsent: LegalConsentData) => void;
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

function normalizeLegalConsent(legalConsent: LegalConsentData): LegalConsentData {
  return {
    agreeAge: legalConsent.agreeAge,
    agreeTerms: legalConsent.agreeTerms,
    agreePersonalDataCollectionUse: legalConsent.agreePersonalDataCollectionUse,
    ...(legalConsent.legalAcceptances ? { legalAcceptances: legalConsent.legalAcceptances } : {}),
    ...(legalConsent.legalBundleSource
      ? { legalBundleSource: legalConsent.legalBundleSource }
      : {}),
  };
}

export function LegalConsentStep({
  legalConsent,
  onLegalConsentChange,
  onNext,
  onBack,
  refreshNonce = 0,
  notice,
}: LegalConsentStepProps) {
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
  const legalConsentRef = useRef(legalConsent);

  useEffect(() => {
    legalConsentRef.current = legalConsent;
  }, [legalConsent]);

  useEffect(() => {
    let cancelled = false;

    getSignupLegalDocumentsBundle().then((result) => {
      if (cancelled) return;

      const nextAcceptances = toLegalAcceptances(result.bundle);
      const currentConsent = normalizeLegalConsent(legalConsentRef.current);
      const shouldResetChecks =
        currentConsent.legalAcceptances !== undefined &&
        !sameLegalAcceptances(currentConsent.legalAcceptances, nextAcceptances);

      onLegalConsentChange({
        agreeAge: shouldResetChecks ? false : currentConsent.agreeAge,
        agreeTerms: shouldResetChecks ? false : currentConsent.agreeTerms,
        agreePersonalDataCollectionUse: shouldResetChecks
          ? false
          : currentConsent.agreePersonalDataCollectionUse,
        legalAcceptances: nextAcceptances,
        legalBundleSource: result.source,
      });
      setBundleState({ status: 'ready', source: result.source, bundle: result.bundle });
    });

    return () => {
      cancelled = true;
    };
  }, [onLegalConsentChange, refreshNonce]);

  const normalizedConsent = normalizeLegalConsent(legalConsent);
  const allAgreed =
    normalizedConsent.agreeAge &&
    normalizedConsent.agreeTerms &&
    normalizedConsent.agreePersonalDataCollectionUse;

  const handleAllAgree = (checked: boolean) => {
    onLegalConsentChange({
      ...normalizedConsent,
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
    if (!normalizedConsent.legalAcceptances) {
      setError('최신 약관 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<FileText className="size-8 text-(--knu-primary)" />}
        title="필수 동의 확인"
        description="가입에 필요한 법적 안내와 동의 항목을 확인해주세요"
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
          <div
            role="status"
            className="rounded-2xl bg-(--knu-background-alt) p-5 text-sm leading-6 text-(--knu-text-secondary)"
          >
            <p className="font-medium text-(--knu-text-primary)">
              최신 동의 항목을 불러오는 중입니다.
            </p>
            <p className="mt-1">약관 정보가 준비되면 다음 단계로 이동할 수 있어요.</p>
          </div>
        ) : (
          <LegalConsentSummaryCard
            checks={{
              agreeAge: normalizedConsent.agreeAge,
              agreeTerms: normalizedConsent.agreeTerms,
              agreePersonalDataCollectionUse: normalizedConsent.agreePersonalDataCollectionUse,
            }}
            bundle={bundleState.bundle}
            source={bundleState.source}
            onToggleAll={handleAllAgree}
            onToggle={(field, checked) => {
              onLegalConsentChange({ ...normalizedConsent, [field]: checked });
              if (checked) setError('');
            }}
            onOpenDocument={setViewingDocument}
          />
        )}

        <FieldError message={error} />

        <p className="text-xs text-(--knu-text-tertiary) mt-2 keep-all">
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
