import { Section } from '../components/Section';
import { FAQItem } from '../components/FAQItem';
import { LandingFaqSkeleton } from '../components/skeletons/LandingFaqSkeleton';
import {
  getLandingFallbackFaqResult,
  getLandingFaqItems,
  type LandingFaqLoadResult,
} from '../api/landing-faq.api';

interface LandingFaqSectionProps {
  faq?: LandingFaqLoadResult;
}

function LandingFaqFrame({ children }: { children: React.ReactNode }) {
  return (
    <Section id="faq" background="alt" className="py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-(--knu-text-primary) mb-6 text-center">
          자주 묻는 질문
        </h2>
        {children}
      </div>
    </Section>
  );
}

export function LandingFaqSection({
  faq = getLandingFallbackFaqResult('fallback_empty'),
}: LandingFaqSectionProps) {
  return (
    <LandingFaqFrame>
      {faq.notice ? (
        <p className="mb-4 rounded-2xl border border-(--knu-border) bg-white px-4 py-3 text-sm text-(--knu-text-secondary)">
          {faq.notice}
        </p>
      ) : null}
      <div className="divide-y divide-(--knu-border)" data-faq-source={faq.status}>
        {faq.items.map((item) => (
          <FAQItem key={item.id} question={item.question} answer={item.answer} />
        ))}
      </div>
    </LandingFaqFrame>
  );
}

export function LandingFaqSectionSkeleton() {
  return (
    <LandingFaqFrame>
      <LandingFaqSkeleton />
    </LandingFaqFrame>
  );
}

export async function LandingDynamicFaqSection() {
  const faq = await getLandingFaqItems();
  return <LandingFaqSection faq={faq} />;
}
