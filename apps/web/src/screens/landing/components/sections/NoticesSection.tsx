import { landingCopy } from '../../model/landingCopy';
import { listNotices, listNoticeTitles } from '../../model/landingNotices';
import { LANDING_SURFACE_SECTION_IDS } from '../../model/landingPolicyCopy';
import { container, revealSection, soft, softDelay } from '../sectionStyles';

// 알아두세요: the section name as the eyebrow and one heading line, then one row per notice, its name
// beside the sentence from md, so each sentence reads on one line.
export function NoticesSection() {
  return (
    <section
      id={LANDING_SURFACE_SECTION_IDS.notices}
      aria-labelledby="tabs-notices-title"
      data-reveal-section=""
      className={`bg-layer-inverse text-fg-on-inverse focus-on-inverse ${revealSection}`}
    >
      <div className={`${container} flex flex-col gap-10 py-section md:py-section-desktop`}>
        <div className={`flex max-w-reading flex-col gap-4 ${soft}`}>
          <p className="text-label font-bold">{landingCopy.noticesTitle}</p>
          <h2
            id="tabs-notices-title"
            className="text-title-1 font-bold break-keep md:text-display-3"
          >
            {landingCopy.noticesLead}
          </h2>
        </div>
        <dl className="flex flex-col border-t border-fg-on-inverse-muted">
          {listNotices.map((notice, index) => (
            <div
              key={notice.id}
              className={`grid grid-cols-1 gap-1 border-b border-fg-on-inverse-muted/30 py-5 md:grid-cols-4 md:gap-6 ${soft} ${softDelay[Math.min(index, 4)]}`}
            >
              <dt className="text-body font-bold">{listNoticeTitles[notice.id]}</dt>
              <dd className="text-body text-fg-on-inverse-muted break-keep md:col-span-3">
                {notice.copy}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
