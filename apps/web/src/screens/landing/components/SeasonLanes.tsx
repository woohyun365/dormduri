import { seasonExplain } from '../model/landingCopy';

// The season section's picture: a year with 시즌 등록 in the two season windows (1–2월, 7–8월). It stays
// compact: no state chips (the main page may rename the states) and no match deadline line (the main
// page shows its D-day). The lane name keeps to one line in a fixed column, and the year runs across on
// phones too, with the name on the left. The month row and the bars are drawn; each season label says
// its months to assistive technology.

const { lanes } = seasonExplain;

function LaneName({ lane }: { lane: { name: string; note: string } }) {
  return (
    <p className="flex flex-col whitespace-nowrap">
      <span className="text-body font-bold text-fg-brand">{lane.name}</span>
      <span className="text-label text-fg-muted">{lane.note}</span>
    </p>
  );
}

export function SeasonLanes() {
  const row = 'flex gap-3 md:gap-6';
  const name = 'w-20 shrink-0 md:w-28';
  const months = 'grid flex-1 grid-cols-12 items-center gap-x-1';
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden="true" className={row}>
        <span className={name} />
        <div className={months}>
          {/* Below sm a cell is narrower than "12월", so only the odd months show; the even months keep
              their cells so the bars stay on their months. */}
          {lanes.months.map((month, index) => (
            <span
              key={month}
              className={`text-label whitespace-nowrap text-fg-muted tabular-nums ${
                index % 2 ? 'invisible sm:visible' : ''
              }`}
            >
              {month}
            </span>
          ))}
        </div>
      </div>
      <div className={`${row} items-start`}>
        <span className={name}>
          <LaneName lane={lanes.season} />
        </span>
        <div className={`${months} pt-1.5`}>
          {lanes.seasons.map((season, index) => (
            <span
              key={season.name}
              className={`col-span-2 flex flex-col gap-1.5 ${index === 0 ? 'col-start-1' : 'col-start-7'}`}
            >
              <span aria-hidden="true" className="h-3 rounded-full bg-brand-solid" />
              <span className="text-label font-bold whitespace-nowrap text-fg-brand">
                {season.name}
                <span className="sr-only">{`, ${season.months}`}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
