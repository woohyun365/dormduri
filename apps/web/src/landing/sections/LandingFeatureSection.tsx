import { Section } from '../components/Section';
import { FeatureCard } from '../components/FeatureCard';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { landingFeatureItems } from '../content/landing-copy';
import { getLandingPolicyCopy } from '../content/landing-policy-copy';

export function LandingFeatureSection() {
  return (
    <Section id="features" background="alt" className="py-16 md:py-24">
      <div className="text-center mb-12">
        <p className="text-sm font-semibold text-[var(--knu-primary)] mb-3">서비스 기능</p>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          주요 기능
        </h2>
        <LandingSentenceText
          text="룸메이트 탐색에 필요한 기능만 선별해 제공합니다. 각 기능은 시즌 상태와 서비스 정책에 따라 이용 가능 여부가 달라집니다."
          className="text-lg text-[var(--knu-text-secondary)] max-w-2xl mx-auto leading-relaxed"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {landingFeatureItems.map((card) => (
          <FeatureCard
            key={card.id}
            icon={<card.icon className={`w-7 h-7 ${card.iconColor}`} aria-hidden="true" />}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>

      <div className="mt-8 bg-white border-2 border-[var(--knu-border)] rounded-2xl p-6 text-center">
        <LandingSentenceText
          text={`${getLandingPolicyCopy('lifestyle_survey_disclaimer').copy} 또한 ${getLandingPolicyCopy('room_selection_not_guaranteed').copy}`}
          className="text-sm text-[var(--knu-text-secondary)] leading-relaxed"
        />
      </div>
    </Section>
  );
}
