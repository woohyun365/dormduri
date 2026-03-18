import Link from 'next/link';
import { Section } from '../components/Section';
import { MockupCard } from '../components/MockupCard';
import { ScrollToButton } from '../components/ScrollToButton';
import { Mail, Sparkles } from 'lucide-react';

export function LandingHeroSection() {
  return (
    <Section className="pt-16 md:pt-24 pb-16 md:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--knu-primary-light)] rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-[var(--knu-primary)]" />
            <span className="text-sm font-semibold text-[var(--knu-primary)]">
              강원대학교 룸메이트 매칭 서비스
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--knu-text-primary)] mb-6 leading-tight">
            학기 시작 전,
            <br />
            생활 패턴 맞는
            <br />
            룸메를 미리 찾기
          </h1>
          <p className="text-lg md:text-xl text-[var(--knu-text-secondary)] mb-2 leading-relaxed">
            @kangwon.ac.kr 인증 필수
            <br />
            현재 춘천캠퍼스 중심 운영 · 학교 공식 일정 기준 시즌제
          </p>
          <p className="text-xs text-[var(--knu-text-tertiary)] mb-6">
            본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/signup"
              className="font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white shadow-sm hover:shadow-md h-14 px-8 text-lg"
            >
              <Mail className="w-5 h-5" />
              이메일로 시작하기
            </Link>
            <ScrollToButton
              targetId="features"
              className="font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 border-2 border-[var(--knu-border)] hover:border-[var(--knu-primary)] hover:bg-[var(--knu-primary-light)] text-[var(--knu-text-primary)] h-14 px-8 text-lg"
            >
              서비스 소개 보기
            </ScrollToButton>
          </div>
        </div>

        <div className="space-y-4">
          <MockupCard variant="banner" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MockupCard variant="profile" profileIndex={0} />
            <MockupCard variant="profile" profileIndex={1} />
          </div>
        </div>
      </div>
    </Section>
  );
}
