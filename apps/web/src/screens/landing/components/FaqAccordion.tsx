// Questions that open in place (details/summary), so they work without script.
export function FaqAccordion({
  items,
  className = '',
}: {
  items: readonly { question: string; answer: string }[];
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      {items.map((item) => (
        <details key={item.question} className="group/faq border-b border-stroke-subtle">
          <summary className="flex min-h-target-primary cursor-pointer list-none items-center justify-between gap-4 py-3 text-body font-medium break-keep focus-visible:focus-ring">
            {item.question}
            <span aria-hidden="true" className="text-title-3 group-open/faq:rotate-45">
              +
            </span>
          </summary>
          <p className="pb-4 text-body-sm text-fg-muted break-keep">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
