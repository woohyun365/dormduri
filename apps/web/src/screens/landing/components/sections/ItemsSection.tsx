import { comparePairs } from '../../model/demoData';
import { landingSectionIds, luckStatement } from '../../model/landingCopy';
import { container, revealSection, soft, softDelay, targetSection } from '../sectionStyles';
import { StatementFields } from '../StatementFields';

// A full-screen statement over the fields the service compares (StatementFields). When it enters, the
// struck-through words flicker like a bulb and settle half gone (the trouble fades).
export function ItemsSection() {
  return (
    <section
      id={landingSectionIds.items}
      tabIndex={-1}
      aria-labelledby="tabs-statement-1"
      data-reveal-section=""
      className={`relative flex min-h-svh scroll-mt-16 flex-col justify-center overflow-hidden py-section ${targetSection} ${revealSection}`}
    >
      <div className={`${container} relative flex flex-col items-center gap-4 text-center`}>
        {/* In the flow above the lead: placed over the section, it ran into the copy once the field
            groups made the statement taller. */}
        <p
          aria-hidden="true"
          className={`pointer-events-none flex flex-wrap justify-center gap-x-6 text-display-1 font-bold text-fg-neutral/10 md:gap-x-10 ${soft} ghost-blink`}
        >
          {luckStatement.ghost.map((word) => (
            <span key={word} data-word={word} className="line-through ghost-word" />
          ))}
        </p>
        <p className={`text-body-sm text-fg-muted break-keep ${soft}`}>{luckStatement.lead}</p>
        <h2
          id="tabs-statement-1"
          className={`text-display-3 font-bold break-keep text-lift md:text-display-1 ${soft} ${softDelay[1]}`}
        >
          <span className="block text-balance">{luckStatement.before}</span>
          <span className="block text-balance">
            {' '}
            <span className="text-fg-brand text-glow">{luckStatement.keyword}</span>
            {luckStatement.after}
          </span>
        </h2>
        <p
          className={`max-w-reading text-body-sm text-fg-muted break-keep ${soft} ${softDelay[1]}`}
        >
          {luckStatement.body}
        </p>
      </div>
      <div className={`${soft} ${softDelay[2]}`}>
        <StatementFields pairs={comparePairs} />
      </div>
    </section>
  );
}
