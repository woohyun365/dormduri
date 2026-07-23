import type { LandingSupportItem } from '../../content/landing-copy';
import { LandingSentenceText } from '../../components/LandingSentenceText';

interface LandingSupportRouteCardProps {
  item: LandingSupportItem;
}

export function LandingSupportRouteCard({ item }: LandingSupportRouteCardProps) {
  return (
    <article className="grid h-full grid-rows-[auto_1fr_auto] rounded-2xl border border-(--knu-border) bg-white p-5 sm:p-6">
      <div>
        <span
          className={`flex size-11 items-center justify-center rounded-xl ${item.iconSurfaceClass}`}
        >
          <item.icon className={`size-5 ${item.iconColor}`} aria-hidden="true" />
        </span>

        <h3 className="mt-5 text-lg/7 font-bold text-(--knu-text-primary)">{item.title}</h3>
        <LandingSentenceText
          text={item.description}
          className="mt-2 text-sm/6 text-(--knu-text-secondary)"
        />
      </div>

      <div className="mt-5">
        <p className="text-xs/5 font-semibold text-slate-500">{item.scopeLabel}</p>
        <ul className="mt-2 space-y-1.5">
          {item.scopeItems.map((scopeItem) => (
            <li key={scopeItem} className="flex items-center gap-2 text-sm/6 text-slate-700">
              <span className="size-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
              {scopeItem}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs/5 font-semibold text-slate-500">{item.entryLabel}</p>
        <p className="mt-0.5 text-sm/6 font-semibold text-slate-700">{item.entryValue}</p>
      </div>
    </article>
  );
}
