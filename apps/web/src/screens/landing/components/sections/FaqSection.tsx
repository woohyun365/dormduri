import { faqItems, landingCopy } from '../../model/landingCopy';
import { FaqAccordion } from '../FaqAccordion';
import { container, revealSection, soft } from '../sectionStyles';

// The FAQ is static copy: the service's FAQ API serves the support center only.
export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="tabs-faq-title"
      data-reveal-section=""
      className={`scroll-mt-16 ${revealSection}`}
    >
      <div
        className={`${container} grid grid-cols-1 gap-6 py-section md:grid-cols-3 md:py-section-desktop`}
      >
        <h2 id="tabs-faq-title" className={`text-title-1 font-bold text-lift ${soft}`}>
          {landingCopy.faqTitle}
        </h2>
        <FaqAccordion items={faqItems} className={`md:col-span-2 ${soft}`} />
      </div>
    </section>
  );
}
