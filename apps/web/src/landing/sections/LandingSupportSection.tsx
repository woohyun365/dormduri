import { ShieldCheck } from 'lucide-react';
import { Section } from '../components/Section';
import { LandingSentenceText } from '../components/LandingSentenceText';
import {
  landingSupportCopy,
  landingSupportItems,
  landingSupportPrivacyNotice,
} from '../content/landing-copy';
import { LandingSupportRouteCard } from './support/LandingSupportRouteCard';

export function LandingSupportSection() {
  return (
    <Section id="support" background="alt" className="py-16 md:py-24">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-start lg:gap-12">
        <div className="max-w-xl lg:pt-2">
          <p className="mb-3 text-sm font-semibold text-(--knu-primary)">
            {landingSupportCopy.eyebrow}
          </p>
          <h2 className="text-3xl/10 font-bold tracking-tight text-(--knu-text-primary) md:text-4xl/12">
            {landingSupportCopy.title}
          </h2>
          <LandingSentenceText
            text={landingSupportCopy.description}
            className="mt-4 text-base/7 text-(--knu-text-secondary) sm:text-lg/8"
          />
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {landingSupportItems.map((item) => (
              <LandingSupportRouteCard key={item.id} item={item} />
            ))}
          </div>

          <aside className="rounded-xl bg-slate-100/70 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center text-slate-500">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm/6 font-bold text-slate-800">
                {landingSupportPrivacyNotice.title}
              </h3>
            </div>

            <dl className="mt-3 divide-y divide-slate-200">
              {landingSupportPrivacyNotice.items.map((item) => (
                <div
                  key={item.label}
                  className="py-2.5 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-xs/5 font-bold text-slate-700">{item.label}</dt>
                  <dd className="mt-0.5 text-xs/5 text-slate-600 sm:mt-0">{item.description}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </Section>
  );
}
