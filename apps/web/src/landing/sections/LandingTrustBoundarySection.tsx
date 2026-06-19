import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingTrustBoundaryItems } from '../content/landing-copy';

export function LandingTrustBoundarySection() {
  return (
    <Section id="trust-boundary" background="alt" className="py-14 md:py-18">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold text-[var(--knu-primary)] mb-3">먼저 확인할 경계</p>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
          서비스 경계를 먼저 확인하세요
        </h2>
        <LandingSentenceText
          text="KNU 룸메는 룸메이트 탐색을 돕는 공개 서비스입니다. 학교가 결정하는 기숙사 배정·호실 선택과 서비스 안의 매칭은 서로 다른 영역입니다."
          className="text-lg text-[var(--knu-text-secondary)] leading-relaxed"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {landingTrustBoundaryItems.map((item) => (
          <article
            key={item.id}
            className="bg-white border-2 border-[var(--knu-border)] rounded-2xl p-5"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--knu-primary-light)] flex items-center justify-center mb-4">
              <item.icon className={`w-6 h-6 ${item.iconColor}`} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-[var(--knu-text-primary)] mb-2">{item.title}</h3>
            <LandingSentenceText
              text={item.description}
              className="text-sm text-[var(--knu-text-secondary)] leading-relaxed"
            />
          </article>
        ))}
      </div>
    </Section>
  );
}
