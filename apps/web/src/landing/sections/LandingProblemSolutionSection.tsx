import { Section } from '../components/Section';
import { FeatureCard } from '../components/FeatureCard';
import { problemCards, solutionCards } from '../content/landingFeatureCards';

export function LandingProblemSolutionSection() {
  return (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {problemCards.map((card) => (
          <FeatureCard
            key={card.title}
            variant="problem"
            icon={<card.icon className={`w-7 h-7 ${card.iconColor}`} />}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>

      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          KNU 룸메가 제공하는 해결책
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {solutionCards.map((card) => (
          <FeatureCard
            key={card.title}
            variant="solution"
            icon={<card.icon className={`w-7 h-7 ${card.iconColor}`} />}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>
    </Section>
  );
}
