'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/form/Checkbox';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { FieldError } from '@/components/form/FieldError';
import { LegalContentModal } from '@/components/legal/LegalContentModal';
import { TERMS_CONTENT } from '@/constants/legal';
import { FileText } from 'lucide-react';

export interface TermsData {
  agreeAge: boolean;
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

interface StepTermsAgreementProps {
  terms: TermsData;
  onTermsChange: (terms: TermsData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTermsAgreement({
  terms,
  onTermsChange,
  onNext,
  onBack,
}: StepTermsAgreementProps) {
  const [error, setError] = useState('');
  const [viewingTerm, setViewingTerm] = useState<'terms' | 'privacy' | null>(null);

  const allAgreed = terms.agreeAge && terms.agreeTerms && terms.agreePrivacy;

  const handleAllAgree = (checked: boolean) => {
    onTermsChange({
      agreeAge: checked,
      agreeTerms: checked,
      agreePrivacy: checked,
    });
    if (checked) setError('');
  };

  const handleNext = () => {
    if (!allAgreed) {
      setError('필수 약관에 모두 동의해주세요.');
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

      <div className="space-y-4">
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-4">
          <Checkbox label="전체 동의" checked={allAgreed} onChange={handleAllAgree} />
        </div>

        <div className="border-2 border-[var(--knu-border)] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Checkbox
              label="[필수] 만 14세 이상입니다"
              checked={terms.agreeAge}
              onChange={(checked) => {
                onTermsChange({ ...terms, agreeAge: checked });
                if (checked) setError('');
              }}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Checkbox
              label="[필수] 이용약관에 동의합니다"
              checked={terms.agreeTerms}
              onChange={(checked) => {
                onTermsChange({ ...terms, agreeTerms: checked });
                if (checked) setError('');
              }}
              required
            />
            <button
              type="button"
              onClick={() => setViewingTerm('terms')}
              className="text-sm text-[var(--knu-primary)] underline flex-shrink-0 ml-2"
            >
              보기
            </button>
          </div>

          <div className="flex items-center justify-between">
            <Checkbox
              label="[필수] 개인정보 처리방침에 동의합니다"
              checked={terms.agreePrivacy}
              onChange={(checked) => {
                onTermsChange({ ...terms, agreePrivacy: checked });
                if (checked) setError('');
              }}
              required
            />
            <button
              type="button"
              onClick={() => setViewingTerm('privacy')}
              className="text-sm text-[var(--knu-primary)] underline flex-shrink-0 ml-2"
            >
              보기
            </button>
          </div>
        </div>

        <FieldError message={error} />

        <p className="text-xs text-[var(--knu-text-tertiary)] mt-2">
          본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다. 약관의 운영 주체는
          강원대학교가 아닌 서비스 운영자 개인입니다.
        </p>
      </div>

      <StepNavigation onBack={onBack} onNext={handleNext} />

      {viewingTerm && TERMS_CONTENT[viewingTerm] && (
        <LegalContentModal
          title={TERMS_CONTENT[viewingTerm].title}
          content={TERMS_CONTENT[viewingTerm].content}
          onClose={() => setViewingTerm(null)}
        />
      )}
    </div>
  );
}
