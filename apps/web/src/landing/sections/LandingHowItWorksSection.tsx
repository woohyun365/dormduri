import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingHowItWorksSteps } from '../content/landing-copy';

export function LandingHowItWorksSection() {
  return (
    <Section id="how-it-works" className="py-16 md:py-24">
      <div className="text-center mb-12">
        <p className="text-sm font-semibold text-(--knu-primary) mb-3">이용 순서</p>
        <h2 className="text-3xl md:text-4xl font-bold text-(--knu-text-primary) mb-4">
          이렇게 이용해요
        </h2>
        <LandingSentenceText
          text="가입, 시즌 프로필 작성, 후보 탐색·대화 흐름을 분리해 안내합니다. 실제 기능 가능 여부는 시즌 상태와 본인 등록 상태에 따라 달라집니다."
          className="text-lg text-(--knu-text-secondary) max-w-2xl mx-auto leading-relaxed"
        />
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {landingHowItWorksSteps.map((step) => {
          const note = 'note' in step ? step.note : undefined;

          return (
            <li
              key={step.id}
              className="relative bg-white border-2 border-(--knu-border) rounded-2xl p-6"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-(--knu-primary) text-white text-sm font-bold mb-5">
                {step.order}
              </span>
              <h3 className="text-xl font-bold text-(--knu-text-primary) mb-3">{step.title}</h3>
              <LandingSentenceText
                text={step.description}
                className="text-(--knu-text-secondary) leading-relaxed"
              />
              {note ? (
                <LandingSentenceText
                  text={note}
                  className="mt-4 rounded-xl bg-(--knu-primary-light) px-4 py-3 text-sm text-(--knu-primary) leading-relaxed"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
