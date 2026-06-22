'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();
  const answerId = `faq-answer-${id}`;
  const buttonId = `faq-button-${id}`;

  return (
    <article className="border-b border-(--knu-border) last:border-0">
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-controls={answerId}
          className="flex min-h-14 w-full items-center justify-between rounded-lg py-5 text-left transition-colors hover:text-(--knu-primary) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
        >
          <span className="pr-4 text-lg font-semibold text-(--knu-text-primary)">{question}</span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-(--knu-text-tertiary) transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      {isOpen ? (
        <div
          id={answerId}
          role="region"
          aria-labelledby={buttonId}
          className="pb-5 leading-relaxed whitespace-pre-line text-(--knu-text-secondary)"
        >
          {answer}
        </div>
      ) : null}
    </article>
  );
}
