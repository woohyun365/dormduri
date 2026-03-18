import { Section } from '../components/Section';
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export function LandingSeasonPolicySection() {
  return (
    <Section background="alt" className="py-16 md:py-24">
      <div className="text-center mb-8">
        <Calendar className="w-12 h-12 text-[var(--knu-primary)] mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          시즌 정책
        </h2>
        <p className="text-lg text-[var(--knu-text-secondary)]">매칭 시즌과 비시즌 운영 안내</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="bg-white border-2 border-[var(--knu-primary)] rounded-2xl p-6">
          <div className="w-12 h-12 bg-[var(--knu-primary)] rounded-xl flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-3">매칭 시즌</h3>
          <p className="text-[var(--knu-text-secondary)] mb-4">
            학교 공식 합격 발표 ~ 호실 선택 마감
          </p>
          <ul className="space-y-2 text-sm text-[var(--knu-text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>프로필 작성·수정 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>후보 리스트 열람 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>매칭 요청·수락 활성</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border-2 border-[var(--knu-border)] rounded-2xl p-6">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-3">비시즌</h3>
          <p className="text-[var(--knu-text-secondary)] mb-4">시즌 외 기간</p>
          <ul className="space-y-2 text-sm text-[var(--knu-text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>프로필 작성·수정 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>같은 캠퍼스 프로필 열람 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-through">매칭 요청·수락 비활성</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-through">북마크 비활성</span>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
