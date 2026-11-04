import {
  flowStepOrder,
  flowSteps,
  flowStepsLabel,
  landingSectionIds,
  stepCaptures,
  type FlowStepId,
} from '../../model/landingCopy';
import { container, revealSection, soft, targetSection } from '../sectionStyles';
import { StepCaptures } from '../StepCaptures';

// Where the visitor is in the three-step flow: the order with the current step marked, shown as
// information only, not links (Owner 2026-10-28: a link put a #section in the address). Plain text, the
// current step in bold brand color: as chips the markers looked like the buttons above (Owner
// 2026-11-04, feedback 5).
function FlowSteps({ current }: { current: FlowStepId }) {
  return (
    <ol aria-label={flowStepsLabel} className="flex items-center gap-2 text-label text-fg-muted">
      {flowStepOrder.map((step, index) => {
        const on = step === current;
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            <span
              aria-current={on ? 'step' : undefined}
              className={on ? 'font-bold text-fg-brand' : undefined}
            >
              <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>{' '}
              {flowSteps[step].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// One of the three steps (01 찾기 · 02 대화 · 03 매칭): the step's copy stays beside its two phone
// capture slots on wide screens (sticky), above them on phones.
export function StepSection({ step }: { step: FlowStepId }) {
  const id = landingSectionIds[step];
  const { title, body } = flowSteps[step];
  const index = flowStepOrder.indexOf(step);
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      data-reveal-section=""
      className={`scroll-mt-16 ${targetSection} ${revealSection}`}
    >
      <div
        className={`${container} grid grid-cols-1 gap-8 py-section md:py-section-desktop lg:grid-cols-5 lg:gap-12`}
      >
        <div className={`flex flex-col gap-4 self-start lg:sticky lg:top-28 lg:col-span-2 ${soft}`}>
          <FlowSteps current={step} />
          <p className="text-display-3 font-bold text-fg-brand text-glow tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </p>
          <h2
            id={`${id}-title`}
            className="text-title-1 font-bold break-keep text-lift md:text-display-3"
          >
            {title}
          </h2>
          <p className="text-body-sm whitespace-pre-line text-fg-muted break-keep">{body}</p>
        </div>
        <div className="lg:col-span-3 scroll-zoom">
          <StepCaptures screens={stepCaptures[step]} />
        </div>
      </div>
    </section>
  );
}
