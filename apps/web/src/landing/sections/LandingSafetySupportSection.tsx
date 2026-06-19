import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingSafetySupportItems } from '../content/landing-copy';

export function LandingSafetySupportSection() {
  return (
    <Section id="safety-support" background="alt" className="py-16 md:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
        <div>
          <p className="text-sm font-semibold text-[var(--knu-primary)] mb-3">안전한 이용과 문의</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-4">
            안전과 문의 경계
          </h2>
          <LandingSentenceText
            text="공개 FAQ는 반복 질문을 줄이는 도움말입니다. 본인 계정, 신고, 이의신청처럼 상황 확인이 필요한 일은 로그인 후 별도 문의로 접수해야 합니다."
            className="text-lg text-[var(--knu-text-secondary)] leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {landingSafetySupportItems.map((item) => (
            <article
              key={item.id}
              className="bg-white border-2 border-[var(--knu-border)] rounded-2xl p-5"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--knu-primary-light)] flex items-center justify-center mb-4">
                <item.icon className={`w-6 h-6 ${item.iconColor}`} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[var(--knu-text-primary)] mb-2">
                {item.title}
              </h3>
              <LandingSentenceText
                text={item.description}
                className="text-sm text-[var(--knu-text-secondary)] leading-relaxed"
              />
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
