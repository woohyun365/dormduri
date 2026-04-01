import { Section } from '../components/Section';
import { FeatureCard } from '../components/FeatureCard';
import { featureCards } from '../content/landingFeatureCards';
import { Info } from 'lucide-react';

export function LandingFeaturesSection() {
  return (
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
        {featureCards.slice(0, 4).map((card) => (
          <FeatureCard
            key={card.title}
            icon={<card.icon className={`w-7 h-7 ${card.iconColor}`} />}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {featureCards.slice(4).map((card) => (
          <FeatureCard
            key={card.title}
            icon={<card.icon className={`w-7 h-7 ${card.iconColor}`} />}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>

      <div className="mt-8 bg-[var(--knu-background-alt)] border-2 border-[var(--knu-border)] rounded-2xl p-6 text-center">
        <Info className="w-6 h-6 text-[var(--knu-text-tertiary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--knu-text-secondary)]">
          매칭 수락 후 서비스 내 1:1 채팅으로 대화할 수 있어요. 호실 선택까지 편리하게 소통하세요.
        </p>
      </div>
    </Section>
  );
}
