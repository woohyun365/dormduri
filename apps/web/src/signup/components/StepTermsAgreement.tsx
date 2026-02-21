'use client';

import { useState } from 'react';
import { Checkbox } from './Checkbox';
import { LandingButton } from '@/landing/components/landing/LandingButton';
import { TERMS_CONTENT } from '@/constants/legal';
import { FileText, X } from 'lucide-react';

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
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-[var(--knu-primary)]" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
          약관 동의
        </h2>
        <p className="text-[var(--knu-text-secondary)]">서비스 이용을 위한 약관에 동의해주세요</p>
      </div>

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

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
            {error}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <LandingButton variant="outline" size="lg" fullWidth onClick={onBack}>
          이전
        </LandingButton>
        <LandingButton variant="primary" size="lg" fullWidth onClick={handleNext}>
          다음 단계
        </LandingButton>
      </div>

      {viewingTerm && TERMS_CONTENT[viewingTerm] && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setViewingTerm(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setViewingTerm(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-modal-title"
            className="bg-white w-full max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--knu-border)]">
              <h3
                id="terms-modal-title"
                className="font-bold text-lg text-[var(--knu-text-primary)]"
              >
                {TERMS_CONTENT[viewingTerm].title}
              </h3>
              <button
                aria-label="닫기"
                onClick={() => setViewingTerm(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-[var(--knu-text-secondary)]" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-wrap">
                {TERMS_CONTENT[viewingTerm].content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
