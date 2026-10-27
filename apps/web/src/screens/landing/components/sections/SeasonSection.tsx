import { seasonExplain } from '../../model/landingCopy';
import { seasonNotice } from '../../model/landingNotices';
import { LANDING_SURFACE_SECTION_IDS } from '../../model/landingPolicyCopy';
import { SeasonLanes } from '../SeasonLanes';
import { container, revealSection, soft, softDelay, targetSection } from '../sectionStyles';

// What a season is, then a year with 시즌 등록 in the two season windows. No current state: the landing
// calls no season API. The policy notice below is the season section's required notice
// (landingPolicyCopy requiredSurface).
export function SeasonSection() {
  return (
    <section
      id={LANDING_SURFACE_SECTION_IDS.season}
      tabIndex={-1}
      aria-labelledby="tabs-season-title"
      data-reveal-section=""
      className={`scroll-mt-16 ${targetSection} ${revealSection}`}
    >
      <div className={`${container} flex flex-col gap-8 py-section md:py-section-desktop`}>
        <div className={`flex max-w-reading flex-col gap-4 ${soft}`}>
          <p className="text-label font-bold text-fg-brand">{seasonExplain.eyebrow}</p>
          <h2
            id="tabs-season-title"
            className="text-title-1 font-bold text-balance break-keep text-lift md:text-display-3"
          >
            {seasonExplain.lead}
          </h2>
        </div>
        <div className={`${soft} ${softDelay[1]}`}>
          <SeasonLanes />
        </div>
        <p className="max-w-reading text-body-sm text-fg-muted break-keep">{seasonNotice.copy}</p>
      </div>
    </section>
  );
}
