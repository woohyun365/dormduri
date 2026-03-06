import Link from 'next/link';
import { LandingHeader } from './components/LandingHeader';

import { Section } from './components/Section';
import { FeatureCard } from './components/FeatureCard';
import { FAQItem } from './components/FAQItem';
import { LandingFooter } from './components/LandingFooter';
import { MockupCard } from './components/MockupCard';
import { ScrollToButton } from './components/ScrollToButton';
import {
  Mail,
  Cigarette,
  Shield,
  Search,
  Users,
  Clock,
  Moon,
  Volume2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Filter,
  UserCheck,
  Calendar,
  Info,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <LandingHeader />

      {/* Hero Section */}
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
            <p className="text-lg md:text-xl text-[var(--knu-text-secondary)] mb-8 leading-relaxed">
              @kangwon.ac.kr 인증 필수
              <br />
              시즌(1~2월/7~8월) 매칭 활성 · 비시즌 열람 가능
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

          {/* Mockup Cards */}
          <div className="space-y-4">
            <MockupCard variant="banner" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MockupCard variant="profile" profileIndex={0} />
              <MockupCard variant="profile" profileIndex={1} />
            </div>
          </div>
        </div>
      </Section>

      {/* Problem → Solution Section */}
      <Section background="alt" className="py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
            기숙사 룸메 배정,
            <br className="md:hidden" /> 이런 고민 있으셨나요?
          </h2>
          <p className="text-lg text-[var(--knu-text-secondary)]">
            무작위 배정의 불안함을 해결합니다
          </p>
        </div>

        {/* Problems */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <FeatureCard
            variant="problem"
            icon={<AlertCircle className="w-7 h-7 text-red-500" />}
            title="무작위 배정 리스크"
            description="생활 패턴이 맞지 않아 학기 내내 불편함을 겪는 경우가 많습니다."
          />
          <FeatureCard
            variant="problem"
            icon={<Search className="w-7 h-7 text-red-500" />}
            title="정보 파편화"
            description="단톡방, SNS, 에브리타임 등 여러 채널에서 룸메를 찾아 혼란스럽습니다."
          />
          <FeatureCard
            variant="problem"
            icon={<Cigarette className="w-7 h-7 text-red-500" />}
            title="흡연 여부"
            description="흡연 여부를 미리 알 수 없어 흡연자와 비흡연자가 매칭되는 경우가 많습니다."
          />
        </div>

        {/* Solutions */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
            KNU 룸메가 제공하는 해결책
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            variant="solution"
            icon={<CheckCircle className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="설문 기반 프로필"
            description="흡연, 수면, 소음, 청결도 등 생활 패턴을 상세히 기록하고 비교할 수 있습니다."
          />
          <FeatureCard
            variant="solution"
            icon={<Filter className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="후보 탐색·필터"
            description="조건에 맞는 룸메 후보를 필터링하고 정렬하여 효율적으로 찾습니다."
          />
          <FeatureCard
            variant="solution"
            icon={<UserCheck className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="시즌 매칭 시스템"
            description="요청과 수락 기능으로 안전하게 매칭하고, 1인 1매칭 원칙을 지킵니다."
          />
        </div>
      </Section>

      {/* Features Section */}
      <Section id="features" className="py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
            주요 기능
          </h2>
          <p className="text-lg text-[var(--knu-text-secondary)]">
            필수 기능만 담은 심플한 룸메 매칭 서비스
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <FeatureCard
            icon={<Mail className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="학교 이메일 인증"
            description="@kangwon.ac.kr 이메일로 강원대 학생만 이용 가능합니다."
          />
          <FeatureCard
            icon={<Users className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="룸메 후보 탐색"
            description="학과, 학년, 성별, 생활 습관 등 원하는 조건으로 후보를 찾을 수 있어요."
          />
          <FeatureCard
            icon={<Clock className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="수면 패턴 비교"
            description="취침/기상 시간과 생활 패턴을 비교해 불편함을 줄여요."
          />
          <FeatureCard
            icon={<Moon className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="소음·야행성 여부"
            description="게임·유튜브·전화 습관 등 생활 소음 요소를 미리 확인할 수 있어요."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Volume2 className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="연결 전 대화"
            description="매칭 전에도 채팅으로 기본 정보를 확인할 수 있어요."
          />
          <FeatureCard
            icon={<Calendar className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="시즌제 운영"
            description="매칭 활성 시즌(1~2월/7~8월) 외에는 열람만 가능해요."
          />
          <FeatureCard
            icon={<Shield className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="안전한 매칭"
            description="학교 이메일 인증과 1인 1매칭으로 안전하게 이용할 수 있어요."
          />
          <FeatureCard
            icon={<Info className="w-7 h-7 text-[var(--knu-primary)]" />}
            title="투명한 정보"
            description="프로필에 기본 정보와 생활 패턴을 명확하게 제공해요."
          />
        </div>
        <div className="mt-8 bg-[var(--knu-background-alt)] border-2 border-[var(--knu-border)] rounded-2xl p-6 text-center">
          <Info className="w-6 h-6 text-[var(--knu-text-tertiary)] mx-auto mb-2" />
          <p className="text-sm text-[var(--knu-text-secondary)]">
            <strong>MVP 단계:</strong> 채팅 기능은 제외되어 있으며, 매칭 후 연락처 교환은 개인적으로
            진행해주세요.
          </p>
        </div>
      </Section>

      {/* Season Policy Section */}
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
              1~2월 (봄학기) / 7~8월 (가을학기)
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
            <p className="text-[var(--knu-text-secondary)] mb-4">3~6월 / 9~12월</p>
            <ul className="space-y-2 text-sm text-[var(--knu-text-secondary)]">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>프로필 작성·수정 가능</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>후보 리스트 열람 가능</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="line-through">매칭 요청·수락 비활성</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* FAQ Section */}
      <Section background="alt" className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-6 text-center">
            자주 묻는 질문
          </h2>
          <div className="divide-y divide-[var(--knu-border)]">
            <FAQItem
              question="비시즌에도 매칭이 가능한가요?"
              answer="비시즌에는 프로필 열람만 가능하며, 매칭 요청은 불가능합니다."
            />
            <FAQItem
              question="학교 인증은 어떻게 하나요?"
              answer="@kangwon.ac.kr 이메일로 인증 메일을 받아 인증을 완료해야 이용할 수 있습니다."
            />
            <FAQItem
              question="개인정보는 안전하게 보호되나요?"
              answer="학교 인증을 통해 신원 확인 후 최소한의 정보만 노출되도록 설계되어 있습니다."
            />
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section className="py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-lg text-[var(--knu-text-secondary)] mb-8">
            학교 이메일로 간편하게 가입하고
            <br />
            나에게 맞는 룸메를 찾아보세요
          </p>
          <Link
            href="/signup"
            className="font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white shadow-sm hover:shadow-md h-14 px-8 text-lg"
          >
            <Mail className="w-5 h-5" />
            이메일로 시작하기
          </Link>
        </div>
      </Section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
