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
    <div className="border-b border-[var(--knu-border)] last:border-0">
      <button
        id={buttonId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={answerId}
        className="w-full flex items-center justify-between py-5 text-left hover:text-[var(--knu-primary)] transition-colors"
      >
        <span className="font-semibold text-lg text-[var(--knu-text-primary)] pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 flex-shrink-0 text-[var(--knu-text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div
          id={answerId}
          role="region"
          aria-labelledby={buttonId}
          className="pb-5 text-[var(--knu-text-secondary)] leading-relaxed"
        >
          {answer}
        </div>
      )}
    </div>
  );
}
