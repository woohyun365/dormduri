'use client';

import { useState } from 'react';
import { Checkbox } from './Checkbox';
import { LandingButton } from '@/landing/components/landing/LandingButton';
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

const TERMS_CONTENT: Record<string, { title: string; content: string }> = {
  terms: {
    title: '이용약관',
    content: `제1조 (목적)
이 약관은 KNU 룸메 서비스(이하 "서비스")의 이용 조건 및 절차, 회원과 서비스 제공자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 강원대학교 재학생을 위한 룸메이트 매칭 플랫폼을 의미합니다.
2. "회원"이란 서비스에 가입하여 이용하는 자를 의미합니다.

제3조 (서비스 이용)
1. 서비스는 강원대학교 이메일 인증을 완료한 회원에 한해 제공됩니다.
2. 회원은 타인의 개인정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.

(이용약관 전체 내용은 추후 업데이트됩니다.)`,
  },
  privacy: {
    title: '개인정보 처리방침',
    content: `1. 수집하는 개인정보 항목
- 이메일 주소 (강원대학교 이메일)
- 닉네임, 비밀번호
- 생활 패턴 정보 (수면시간, 흡연여부, 청결도, 소음민감도)

2. 개인정보의 수집 및 이용 목적
- 회원 식별 및 가입의사 확인
- 룸메이트 매칭 서비스 제공
- 서비스 관련 공지사항 전달

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다.

(개인정보 처리방침 전체 내용은 추후 업데이트됩니다.)`,
  },
};

export function StepTermsAgreement({
  terms,
  onTermsChange,
  onNext,
  onBack,
}: StepTermsAgreementProps) {
  const [error, setError] = useState('');
  const [viewingTerm, setViewingTerm] = useState<string | null>(null);

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
