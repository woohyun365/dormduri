import { Info } from 'lucide-react';
import { Section } from '../components/Section';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { landingMatchingCapabilitySteps } from '../content/landing-copy';
import { LandingMatchingCapabilityFlow } from './features/LandingMatchingCapabilityFlow';

export function LandingFeatureSection() {
  return (
    <Section id="features" background="alt" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-left md:mb-10 md:text-center">
          <p className="mb-3 text-sm font-semibold text-(--knu-primary)">서비스 기능</p>
          <h2 className="mb-4 text-3xl/10 font-bold tracking-tight text-(--knu-text-primary) md:text-4xl/12">
            주요 기능
          </h2>
          <LandingSentenceText
            text="상대의 생활패턴을 확인하고, 대화와 매칭으로 이어가요."
            className="max-w-2xl text-base/7 text-(--knu-text-secondary) sm:text-lg/8 md:mx-auto"
          />
        </div>

        <LandingMatchingCapabilityFlow steps={landingMatchingCapabilitySteps} />

        <aside
          aria-label="생활패턴 정보 안내"
          className="mt-5 flex items-start gap-2.5 px-1 text-sm/6 text-(--knu-text-secondary) md:justify-center"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-(--knu-primary)" aria-hidden="true" />
          <p>생활패턴 정보는 서로를 알아가기 위한 참고 자료예요.</p>
        </aside>
      </div>
    </Section>
  );
}
