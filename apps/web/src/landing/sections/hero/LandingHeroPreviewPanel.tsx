import { PanelsTopLeft } from 'lucide-react';
import { LandingProfilePreviewCard } from '../../components/LandingProfilePreviewCard';
import { landingHeroCopy } from '../../content/landing-copy';
import { landingHeroProfilePreview } from '../../content/landing-profile-preview.examples';

const previewTitleId = 'landing-hero-preview-title';

export function LandingHeroPreviewPanel() {
  const preview = landingHeroCopy.preview;

  return (
    <figure
      aria-labelledby={previewTitleId}
      className="-mx-2 w-auto rounded-3xl border border-slate-200 bg-slate-50/80 p-3 sm:mx-0 sm:w-full sm:p-5 lg:p-6"
    >
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
          <PanelsTopLeft className="size-3.5" aria-hidden="true" />
          {preview.label}
        </span>
        <h2
          id={previewTitleId}
          className="mt-3 text-lg/7 font-bold tracking-tight text-(--knu-text-primary) sm:text-xl/8"
        >
          {preview.title}
        </h2>
        <p className="mt-1 text-sm/6 text-(--knu-text-secondary)">{preview.description}</p>
      </div>

      <LandingProfilePreviewCard profile={landingHeroProfilePreview} />

      <figcaption className="mt-3 text-xs/5 text-(--knu-text-tertiary)">
        {preview.caption}
      </figcaption>
    </figure>
  );
}
