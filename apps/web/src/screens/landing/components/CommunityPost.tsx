import {
  LIFESTYLE_FIELD_OPTIONS,
  formatLifestyleFieldName,
  formatLifestyleOptionLabel,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Highlighter,
  Lock,
  MessageCircle,
  PenLine,
  Plus,
  RotateCw,
  Star,
  ThumbsUp,
  Undo2,
} from 'lucide-react';
import { exampleViewer } from '../model/demoData';
import { examplePost, landingCopy, serviceWindow } from '../model/landingCopy';
import { CaptureSlot } from './CaptureSlot';

// How students look for roommates today: a campus community post seen in Chrome, with a checklist
// image marked up in a tablet or PDF editor; and the service beside it as a browser window around the
// main page. Built as components around an invented example post (model examplePost). The window is a
// light surface inside the dark page (palette light, a nestable context).

type Mark = 'highlight' | 'circle' | 'underline';

interface ChecklistRow {
  readonly field: keyof LifestyleData;
  readonly picked: string;
  readonly mark: Mark;
}

// The poster's marks. The five fields carry the example visitor's answers (demoData), so the score
// on the right is the score of this checklist.
const mine: readonly ChecklistRow[] = [
  { field: 'bedtime', picked: exampleViewer.bedtime ?? '24_02', mark: 'circle' },
  { field: 'wakeTime', picked: exampleViewer.wakeTime ?? '08_09', mark: 'highlight' },
  {
    field: 'noiseSensitivity',
    picked: exampleViewer.noiseSensitivity ?? 'SENSITIVE',
    mark: 'circle',
  },
  { field: 'sleepHabit', picked: 'NONE', mark: 'highlight' },
  { field: 'indoorEating', picked: 'SNACK', mark: 'underline' },
  { field: 'temperatureSensitivity', picked: 'HOT', mark: 'highlight' },
];
const wanted: readonly ChecklistRow[] = [
  {
    field: 'phoneTolerance',
    picked: exampleViewer.phoneTolerance ?? 'BRIEF_OK',
    mark: 'highlight',
  },
  {
    field: 'cleanExpectation',
    picked: exampleViewer.cleanExpectation ?? 'BASIC',
    mark: 'underline',
  },
  { field: 'smokingTolerance', picked: 'NO_ONLY', mark: 'circle' },
  { field: 'earphoneExpectation', picked: 'MUST', mark: 'highlight' },
];

// Blue labels of the post. Blue on the light window holds 4.5:1 with almost no room, so they turn dark
// while the window sits behind and darkens (data-back on its stack cell).
const backLabel = 'text-fg-brand in-data-back:text-fg-neutral';

// A hand-drawn loop or underline around a marked answer; it draws itself when the section enters.
function PenMark({ mark }: { mark: Exclude<Mark, 'highlight'> }) {
  if (mark === 'underline') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 -bottom-1 h-2 w-full overflow-visible"
      >
        <path
          d="M2 6 C 25 2, 50 9, 75 4 S 96 6, 98 5"
          pathLength={1}
          className="fill-none stroke-fg-on-annotation pen-stroke group-data-pending:pen-stroke-pending"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  return (
    <span aria-hidden="true" className="pointer-events-none absolute -inset-x-2 -inset-y-1.5">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="size-full overflow-visible">
        <path
          d="M8 22 C 6 8, 40 2, 70 4 C 94 6, 98 18, 92 28 C 84 38, 30 40, 12 32 C 4 28, 6 16, 16 12"
          pathLength={1}
          className="fill-none stroke-fg-on-annotation pen-stroke group-data-pending:pen-stroke-pending"
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

function MarkedOption({ label, mark }: { label: string; mark: Mark }) {
  if (mark === 'highlight') {
    return (
      <mark className="bg-annotation-marker px-0.5 font-bold text-fg-on-annotation">{label}</mark>
    );
  }
  return (
    <span className="relative inline-block px-0.5 font-bold">
      {label}
      <PenMark mark={mark} />
    </span>
  );
}

function ChecklistGroup({ title, rows }: { title: string; rows: readonly ChecklistRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className={`text-label font-bold ${backLabel}`}>{title}</p>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.field} className="flex flex-col gap-1">
            <dt className={`text-label font-bold ${backLabel}`}>
              {formatLifestyleFieldName(row.field)}
            </dt>
            <dd className="text-label break-keep text-fg-muted">
              {LIFESTYLE_FIELD_OPTIONS[row.field].map((option, index) => (
                <span key={option}>
                  {index > 0 ? ' / ' : ''}
                  {option === row.picked ? (
                    <MarkedOption
                      label={formatLifestyleOptionLabel(row.field, option)}
                      mark={row.mark}
                    />
                  ) : (
                    formatLifestyleOptionLabel(row.field, option)
                  )}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The attached checklist image, open in an editor: a floating tool bar over the marked-up sheet.
function MarkedChecklist() {
  const { tools: names, checklist } = examplePost;
  const tools = [
    { label: names.pen, Icon: PenLine, on: true },
    { label: names.highlighter, Icon: Highlighter, on: false },
    { label: names.eraser, Icon: Eraser, on: false },
    { label: names.undo, Icon: Undo2, on: false },
  ];
  return (
    <figure className="relative flex flex-col gap-4 rounded-control border border-stroke-subtle bg-layer-basement p-4 pt-12">
      <div
        aria-hidden="true"
        className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-stroke-subtle bg-layer-default px-2 py-1 depth-card"
      >
        {tools.map(({ label, Icon, on }) => (
          <span
            key={label}
            title={label}
            className={`flex size-7 items-center justify-center rounded-full ${on ? 'bg-fg-neutral text-layer-default' : 'text-fg-muted'}`}
          >
            <Icon className="size-4" />
          </span>
        ))}
        <span className="ml-1 size-4 rounded-full border border-stroke-neutral bg-annotation-marker" />
      </div>
      <figcaption className={`absolute top-3 left-4 text-body-sm font-bold ${backLabel}`}>
        {checklist.title}
      </figcaption>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <ChecklistGroup title={checklist.mine} rows={mine} />
        <ChecklistGroup title={checklist.wanted} rows={wanted} />
      </div>
    </figure>
  );
}

// Chrome's tab strip and address bar on macOS (the macOS look only): the traffic lights before the
// tabs.
function ChromeBar({ tab, url }: { tab: string; url: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col border-b border-stroke-subtle bg-layer-basement"
    >
      <div className="flex items-end gap-3 px-3 pt-2">
        <span className="flex gap-1.5 pb-2.5">
          <span className="size-2.5 rounded-full bg-window-close" />
          <span className="size-2.5 rounded-full bg-window-minimize" />
          <span className="size-2.5 rounded-full bg-window-zoom" />
        </span>
        <span className="flex min-w-0 items-center gap-2 rounded-t-control bg-layer-default px-3 py-1.5 text-label">
          <span className="size-3 shrink-0 rounded-input bg-brand-solid" />
          <span className="truncate">{tab}</span>
        </span>
        <Plus className="mb-2 size-4 shrink-0 text-fg-muted" />
      </div>
      <div className="flex items-center gap-3 bg-layer-default px-3 py-2 text-fg-muted">
        <ChevronLeft className="size-4" />
        <ChevronRight className="size-4" />
        <RotateCw className="size-3.5" />
        <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-layer-basement px-3 py-1 text-label">
          <Lock className="size-3 shrink-0" />
          <span className="truncate">{url}</span>
        </span>
      </div>
    </div>
  );
}

export function CommunityPost() {
  return (
    <div
      data-palette="light"
      className="overflow-hidden rounded-panel border border-stroke-subtle bg-layer-default text-fg-neutral depth-window"
    >
      <ChromeBar tab={examplePost.tab} url={examplePost.url} />
      <article className="flex flex-col gap-4 p-4 md:p-5">
        <header className="flex items-start gap-3">
          <span aria-hidden="true" className="size-10 rounded-control bg-placeholder-fill" />
          <div className="flex flex-1 flex-col">
            <p className="text-body-sm font-bold">{examplePost.author}</p>
            <p className="text-label text-fg-muted">{examplePost.time}</p>
          </div>
          <p className="text-label text-fg-muted">{examplePost.actions}</p>
        </header>
        <h3 className="flex flex-wrap items-center gap-2 text-title-2 font-bold break-keep">
          {examplePost.title}
          <span
            className={`rounded-full bg-brand-weak px-2 py-0.5 text-label font-bold ${backLabel}`}
          >
            {`${landingCopy.exampleTag} ${examplePost.tagNoun}`}
          </span>
        </h3>
        <div className="flex flex-col gap-1 text-body-sm break-keep">
          {examplePost.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <MarkedChecklist />
        <footer className="flex gap-4 text-label text-fg-muted">
          <span className="flex items-center gap-1">
            <ThumbsUp aria-hidden="true" className="size-4" /> {examplePost.reactions.like}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle aria-hidden="true" className="size-4" /> {examplePost.reactions.comment}
          </span>
          <span className="flex items-center gap-1">
            <Star aria-hidden="true" className="size-4" /> {examplePost.reactions.scrap}
          </span>
        </footer>
      </article>
    </div>
  );
}

// The service side: the same browser window around a gray slot for a capture of the main page, so the
// capture drops in once the main page design is done.
export function ServiceWindow() {
  return (
    <div className="overflow-hidden rounded-panel border border-stroke-subtle bg-layer-default text-fg-neutral depth-window">
      <ChromeBar tab={serviceWindow.tab} url={serviceWindow.url} />
      <CaptureSlot label={serviceWindow.slot} size={serviceWindow.size} className="aspect-16/10" />
    </div>
  );
}
