import { DEADLINE_TONE_STYLES } from './model/primaryStyles';
import type { PrimaryDateRow } from './model/primaryTypes';

export function PrimaryDateRows({ title, rows }: { title?: string; rows: PrimaryDateRow[] }) {
  const sectionTone = rows.find((row) => row.tone)?.tone;
  const sectionClassName = sectionTone
    ? DEADLINE_TONE_STYLES[sectionTone].panel
    : 'border-white/70 bg-white/70';

  return (
    <div
      className={`space-y-2 rounded-xl border p-3 shadow-sm shadow-slate-200/50 backdrop-blur-sm ${sectionClassName}`}
    >
      {title && <p className="text-xs font-bold text-slate-700">{title}</p>}
      <div className="space-y-1.5">
        {rows.map((row) => {
          const rowTone = row.tone ? DEADLINE_TONE_STYLES[row.tone] : null;

          return (
            <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
              <span className={`font-semibold ${rowTone?.text ?? 'text-slate-700'}`}>
                {row.label}:
              </span>
              <div className="flex min-w-0 items-center gap-2">
                {row.pill && (
                  <span
                    className={`${row.hidePillOnNarrow ? 'hidden min-[360px]:inline-flex' : 'inline-flex'} shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold ring-1 ring-white/80 ${rowTone?.text ?? 'text-slate-700'}`}
                  >
                    {row.pill}
                  </span>
                )}
                <span
                  className={`${row.hideValueOnNarrow ? 'hidden min-[360px]:inline' : 'inline'} truncate ${rowTone?.text ?? 'text-slate-700'}`}
                >
                  {row.value}
                </span>
                {row.strongValue && (
                  <strong
                    className={`shrink-0 font-extrabold ${rowTone?.text ?? 'text-slate-800'}`}
                  >
                    {row.strongValue}
                  </strong>
                )}
                {row.badge && (
                  <span
                    className={`${row.hideBadgeOnNarrow ? 'hidden min-[360px]:inline-flex' : 'inline-flex'} rounded-full px-2 py-0.5 text-xs font-bold text-white ${rowTone?.badge ?? 'bg-blue-500'}`}
                  >
                    {row.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
