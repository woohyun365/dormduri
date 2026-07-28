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
import { LegalConsentNotice } from './LegalConsentNotice';

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
  requiresReconfirmation?: boolean;
  legalDocumentsResult?: Awaited<ReturnType<typeof getSignupLegalDocumentsBundle>>;
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
  requiresReconfirmation = false,
  legalDocumentsResult,
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

    const bundleRequest = legalDocumentsResult
      ? Promise.resolve(legalDocumentsResult)
      : getSignupLegalDocumentsBundle();

    bundleRequest.then((result) => {
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
  }, [legalDocumentsResult, onLegalConsentChange, refreshNonce]);

  const normalizedConsent = normalizeLegalConsent(legalConsent);
  const allAgreed =
    normalizedConsent.agreeAge &&
    normalizedConsent.agreeTerms &&
    normalizedConsent.agreePersonalDataCollectionUse;
  const isUsingFallback = bundleState.status === 'ready' && bundleState.source === 'fallback';
  const noticeStatus = requiresReconfirmation ? 'stale' : isUsingFallback ? 'fallback' : null;

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
      setError('필수 확인·동의 항목을 모두 선택해 주세요.');
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
        title="필수 항목 확인"
        description="각 내용을 확인한 뒤 필수 항목에 동의해요."
      />

      <div className="space-y-4">
        {noticeStatus && (
          <LegalConsentNotice status={noticeStatus} isUsingFallback={isUsingFallback} />
        )}

        {bundleState.status === 'loading' ? (
          <div
            role="status"
            className="rounded-2xl bg-(--knu-background-alt) p-5 text-sm leading-6 text-(--knu-text-secondary)"
          >
            <p className="font-medium text-(--knu-text-primary)">필수 내용을 불러오고 있어요.</p>
            <p className="mt-1">잠시만 기다려 주세요.</p>
          </div>
        ) : (
          <LegalConsentSummaryCard
            checks={{
              agreeAge: normalizedConsent.agreeAge,
              agreeTerms: normalizedConsent.agreeTerms,
              agreePersonalDataCollectionUse: normalizedConsent.agreePersonalDataCollectionUse,
            }}
            bundle={bundleState.bundle}
            onToggleAll={handleAllAgree}
            onToggle={(field, checked) => {
              onLegalConsentChange({ ...normalizedConsent, [field]: checked });
              if (checked) setError('');
            }}
            onOpenDocument={setViewingDocument}
          />
        )}

        <FieldError message={error} />
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
