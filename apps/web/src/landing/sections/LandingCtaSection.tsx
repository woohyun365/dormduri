import { Section } from '../components/Section';
import { LandingPrimaryCtaLink } from '../components/LandingPrimaryCtaLink';
import { Mail } from 'lucide-react';

export function LandingCtaSection() {
  return (
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
        <LandingPrimaryCtaLink href="/signup">
          <Mail className="w-5 h-5" />
          이메일로 시작하기
        </LandingPrimaryCtaLink>
      </div>
    </Section>
  );
}
