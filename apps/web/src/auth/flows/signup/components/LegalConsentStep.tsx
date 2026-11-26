import { useEffect, useId, useRef, useState } from 'react';
import type {
  ActiveLegalDocumentsBundleResponse,
  LegalDocumentResponse,
  SignupLegalAcceptances,
} from '@repo/shared/legal';
import { StepHeader } from '@/auth/components/StepHeader';
import { StepNavigation } from './StepNavigation';
import { Field, FieldMessage } from '@/auth/components/form/Field';
import {
  getSignupLegalDocumentsBundle,
  type SignupLegalDocumentsBundleResult,
} from '@/legal/api/legal-documents-bundle.api';
import {
  LegalConsentSummaryCard,
  type LegalConsentSummaryCardHandle,
} from '@/legal/components/LegalConsentSummaryCard';
import { LegalDocumentDialog } from '@/legal/components/LegalDocumentDialog';
import { FileText } from 'lucide-react';
import { LegalConsentNotice } from './LegalConsentNotice';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';

export interface LegalConsentData {
  agreeAge: boolean;
  agreeTerms: boolean;
  agreePersonalDataCollectionUse: boolean;
  legalAcceptances?: SignupLegalAcceptances;
}

interface LegalConsentStepProps {
  legalConsent: LegalConsentData;
  onLegalConsentChange: (legalConsent: LegalConsentData) => void;
  onNext: () => void;
  onBack: () => void;
  refreshNonce?: number;
  requiresReconfirmation?: boolean;
  legalDocumentsResult?: SignupLegalDocumentsBundleResult;
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
  const [invalidSubmitCount, setInvalidSubmitCount] = useState(0);
  // Without the bundle there are no version ids to agree to, so the step blocks.
  const [bundleState, setBundleState] = useState<
    | { status: 'loading' }
    | { status: 'unavailable' }
    | { status: 'ready'; bundle: ActiveLegalDocumentsBundleResponse }
  >({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [viewingDocument, setViewingDocument] = useState<LegalDocumentResponse | null>(null);
  const legalConsentRef = useRef(legalConsent);
  const consentSummaryRef = useRef<LegalConsentSummaryCardHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const validationErrorId = useId();

  useEffect(() => {
    legalConsentRef.current = legalConsent;
  }, [legalConsent]);

  useEffect(() => {
    if (invalidSubmitCount <= 0 || !error) return;
    focusAndScroll(consentSummaryRef.current?.getFirstUncheckedControl());
  }, [error, invalidSubmitCount]);

  useEffect(() => {
    let cancelled = false;

    const bundleRequest = legalDocumentsResult
      ? Promise.resolve(legalDocumentsResult)
      : getSignupLegalDocumentsBundle();

    bundleRequest.then((result) => {
      if (cancelled) return;

      if (result.status === 'unavailable') {
        // The checks were given for the version ids that are gone now. Without them the next bundle could not
        // tell whether its versions changed, so none of the checks is kept.
        onLegalConsentChange({
          agreeAge: false,
          agreeTerms: false,
          agreePersonalDataCollectionUse: false,
        });
        setBundleState({ status: 'unavailable' });
        return;
      }

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
      });
      setBundleState({ status: 'ready', bundle: result.bundle });
    });

    return () => {
      cancelled = true;
    };
  }, [legalDocumentsResult, onLegalConsentChange, refreshNonce, retryCount]);

  const normalizedConsent = normalizeLegalConsent(legalConsent);
  const allAgreed =
    normalizedConsent.agreeAge &&
    normalizedConsent.agreeTerms &&
    normalizedConsent.agreePersonalDataCollectionUse;
  const isUnavailable = bundleState.status === 'unavailable';
  const noticeStatus = isUnavailable ? 'unavailable' : requiresReconfirmation ? 'stale' : null;
  const retryBundle = () => {
    // The retry button goes away while the bundle loads; the step heading keeps the keyboard position.
    headingRef.current?.focus();
    setBundleState({ status: 'loading' });
    setRetryCount((count) => count + 1);
  };

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
      setInvalidSubmitCount((current) => current + 1);
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
        headingRef={headingRef}
      />

      {noticeStatus && (
        <LegalConsentNotice
          status={noticeStatus}
          onRetry={isUnavailable ? retryBundle : undefined}
        />
      )}

      <Field invalid={Boolean(error)} className="space-y-4">
        {bundleState.status === 'loading' ? (
          <div
            role="status"
            className="rounded-2xl bg-(--knu-background-alt) p-5 text-sm leading-6 text-(--knu-text-secondary)"
          >
            <p className="font-medium text-(--knu-text-primary)">필수 내용을 불러오고 있어요.</p>
            <p className="mt-1">잠시만 기다려 주세요.</p>
          </div>
        ) : bundleState.status === 'unavailable' ? null : (
          <LegalConsentSummaryCard
            ref={consentSummaryRef}
            checks={{
              agreeAge: normalizedConsent.agreeAge,
              agreeTerms: normalizedConsent.agreeTerms,
              agreePersonalDataCollectionUse: normalizedConsent.agreePersonalDataCollectionUse,
            }}
            bundle={bundleState.bundle}
            validationErrorId={validationErrorId}
            showValidationErrors={Boolean(error)}
            onToggleAll={handleAllAgree}
            onToggle={(field, checked) => {
              const nextConsent = { ...normalizedConsent, [field]: checked };
              onLegalConsentChange(nextConsent);
              if (
                nextConsent.agreeAge &&
                nextConsent.agreeTerms &&
                nextConsent.agreePersonalDataCollectionUse
              ) {
                setError('');
              }
            }}
            onOpenDocument={setViewingDocument}
          />
        )}

        <FieldMessage error={error} errorId={validationErrorId} />
      </Field>

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        disabled={bundleState.status !== 'ready'}
      />

      {viewingDocument && (
        <LegalDocumentDialog document={viewingDocument} onClose={() => setViewingDocument(null)} />
      )}
    </div>
  );
}
