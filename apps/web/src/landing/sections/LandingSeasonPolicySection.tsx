import { Section } from '../components/Section';
import { Calendar, CheckCircle, Clock, AlertCircle, Sparkles } from 'lucide-react';

export function LandingSeasonPolicySection() {
  return (
    <Section id="season" background="alt" className="py-16 md:py-24">
      <div className="text-center mb-8">
        <Calendar className="w-12 h-12 text-[var(--knu-primary)] mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          시즌 정책
        </h2>
        <p className="text-lg text-[var(--knu-text-secondary)]">
          비시즌 · 시즌 오픈 · 시즌 매칭, 3단계 운영 안내
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {/* 비시즌 */}
        <div className="bg-white border-2 border-[var(--knu-border)] rounded-2xl p-6">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-3">비시즌</h3>
          <p className="text-[var(--knu-text-secondary)] mb-4">시즌 외 기간</p>
          <ul className="space-y-2 text-sm text-[var(--knu-text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>프로필 전체 수정 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>같은 캠퍼스 유저 프로필 열람</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-through">매칭 요청·수락</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-through">북마크</span>
            </li>
          </ul>
        </div>

        {/* 시즌 오픈 */}
        <div className="bg-white border-2 border-blue-300 rounded-2xl p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-3">시즌 오픈</h3>
          <p className="text-[var(--knu-text-secondary)] mb-4">매칭 시작 전 준비 기간</p>
          <ul className="space-y-2 text-sm text-[var(--knu-text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>프로필 전체 수정 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>같은 건물 유저 프로필 열람</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>북마크</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-through">매칭 요청·수락</span>
            </li>
          </ul>
        </div>

        {/* 시즌 매칭 */}
        <div className="bg-white border-2 border-[var(--knu-primary)] rounded-2xl p-6">
          <div className="w-12 h-12 bg-[var(--knu-primary)] rounded-xl flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-3">시즌 매칭</h3>
          <p className="text-[var(--knu-text-secondary)] mb-4">호실 선택일까지 약 4주</p>
          <ul className="space-y-2 text-sm text-[var(--knu-text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>원하는 조건·자기소개 수정 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-through">나의 생활패턴 수정 불가</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>같은 건물 유저 프로필 열람</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>매칭 요청·수락</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5" />
              <span>북마크</span>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
