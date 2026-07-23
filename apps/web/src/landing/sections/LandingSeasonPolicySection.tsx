import { LandingSentenceText } from '../components/LandingSentenceText';
import { Section } from '../components/Section';
import { landingSeasonJourneyItems } from '../content/landing-copy';
import { LandingSeasonJourney } from './season-policy/LandingSeasonJourney';

export function LandingSeasonPolicySection() {
  return (
    <Section id="season" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-left md:mb-10 md:text-center">
          <p className="mb-3 text-sm font-semibold text-(--knu-primary)">시즌별 이용 범위</p>
          <h2 className="mb-4 text-3xl/10 font-bold tracking-tight text-(--knu-text-primary) md:text-4xl/12">
            시즌에 따라 달라요
          </h2>
          <LandingSentenceText
            text="학교 공식 일정에 맞추어 시즌이 등록돼요."
            className="max-w-2xl text-base/7 text-(--knu-text-secondary) sm:text-lg/8 md:mx-auto"
          />
        </div>

        <LandingSeasonJourney items={landingSeasonJourneyItems} />
      </div>
    </Section>
  );
}
