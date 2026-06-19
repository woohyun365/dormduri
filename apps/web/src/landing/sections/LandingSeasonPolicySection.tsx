import { AlertCircle, Calendar, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingSeasonPolicyCards } from '../content/landing-copy';
import { getLandingPolicyCopy } from '../content/landing-policy-copy';

const accentStyles = {
  neutral: {
    border: 'border-[var(--knu-border)]',
    iconBox: 'bg-gray-100',
    icon: 'text-gray-500',
    Icon: Clock,
  },
  blue: {
    border: 'border-blue-300',
    iconBox: 'bg-blue-100',
    icon: 'text-blue-600',
    Icon: Sparkles,
  },
  primary: {
    border: 'border-[var(--knu-primary)]',
    iconBox: 'bg-[var(--knu-primary)]',
    icon: 'text-white',
    Icon: CheckCircle,
  },
  amber: {
    border: 'border-amber-300',
    iconBox: 'bg-amber-100',
    icon: 'text-amber-600',
    Icon: Calendar,
  },
} as const;

export function LandingSeasonPolicySection() {
  return (
    <Section id="season" className="py-16 md:py-24">
      <div className="text-center mb-10">
        <Calendar className="w-12 h-12 text-[var(--knu-primary)] mx-auto mb-4" aria-hidden="true" />
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          시즌별로 열리는 기능이 달라요
        </h2>
        <LandingSentenceText
          text={`${getLandingPolicyCopy('season_capability_boundary').copy} 시즌 일정과 기능 허용 여부는 서비스 정책이 최종 판단합니다.`}
          className="text-lg text-[var(--knu-text-secondary)] max-w-3xl mx-auto leading-relaxed"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {landingSeasonPolicyCards.map((card) => {
          const styles = accentStyles[card.accent];
          const Icon = styles.Icon;

          return (
            <article
              key={card.state}
              className={`bg-white border-2 ${styles.border} rounded-2xl p-6`}
            >
              <div
                className={`w-12 h-12 ${styles.iconBox} rounded-xl flex items-center justify-center mb-4`}
              >
                <Icon className={`w-6 h-6 ${styles.icon}`} aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-2">
                {card.label}
              </h3>
              <LandingSentenceText
                text={card.description}
                className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-4"
              />
              <div className="space-y-4 text-sm text-[var(--knu-text-secondary)]">
                <div>
                  <p className="font-semibold text-[var(--knu-text-primary)] mb-2">가능한 기능</p>
                  <ul className="space-y-2">
                    {card.available.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle
                          className="w-4 h-4 text-[var(--knu-primary)] flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-[var(--knu-text-primary)] mb-2">닫히는 기능</p>
                  <ul className="space-y-2">
                    {card.unavailable.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <AlertCircle
                          className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
