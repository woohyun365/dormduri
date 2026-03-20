import { Section } from '../components/Section';
import { FAQItem } from '../components/FAQItem';
import { landingFaqItems } from '../content/landingFaqItems';

export function LandingFaqSection() {
  return (
    <Section id="faq" background="alt" className="py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--knu-text-primary)] mb-6 text-center">
          자주 묻는 질문
        </h2>
        <div className="divide-y divide-[var(--knu-border)]">
          {landingFaqItems.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </Section>
  );
}
