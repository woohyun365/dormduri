'use client';

import { useCallback, useMemo, useState } from 'react';
import { SignupFlowView } from '@/auth/flows/signup/SignupFlowView';
import {
  LegalConsentStep,
  type LegalConsentData,
} from '@/auth/flows/signup/components/LegalConsentStep';
import { SIGNUP_LEGAL_BUNDLE, SIGNUP_LEGAL_CONSENT } from '../auth-story-fixtures';

const noop = () => undefined;

type LegalScenario = 'entry' | 'agreed' | 'fallback' | 'stale';

export function SignupLegalScenario({ scenario }: { scenario: LegalScenario }) {
  const [legalConsent, setLegalConsent] = useState<LegalConsentData>(
    scenario === 'agreed'
      ? SIGNUP_LEGAL_CONSENT
      : {
          agreeAge: false,
          agreeTerms: false,
          agreePersonalDataCollectionUse: false,
        },
  );
  const handleLegalConsentChange = useCallback((next: LegalConsentData) => {
    setLegalConsent(next);
  }, []);
  const legalDocumentsResult = useMemo(
    () => ({
      source: scenario === 'fallback' ? ('fallback' as const) : ('api' as const),
      bundle: SIGNUP_LEGAL_BUNDLE,
    }),
    [scenario],
  );

  return (
    <SignupFlowView currentStep={2}>
      <LegalConsentStep
        legalConsent={legalConsent}
        onLegalConsentChange={handleLegalConsentChange}
        onNext={noop}
        onBack={noop}
        requiresReconfirmation={scenario === 'stale'}
        legalDocumentsResult={legalDocumentsResult}
      />
    </SignupFlowView>
  );
}
