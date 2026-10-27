import { beforeTitle, landingSectionIds } from '../../model/landingCopy';
import { BeforeStack } from '../BeforeStack';
import { CommunityPost, ServiceWindow } from '../CommunityPost';
import { container, revealSection, soft, targetSection } from '../sectionStyles';

// 무엇이 다른가요: the old way (a community post with a checklist) against the service, as two
// overlapping browser windows. The heading's second line is muted.
export function BeforeSection() {
  return (
    <section
      id={landingSectionIds.before}
      tabIndex={-1}
      aria-labelledby="tabs-before-title"
      data-reveal-section=""
      className={`scroll-mt-16 bg-layer-default ${targetSection} ${revealSection}`}
    >
      <div className={`${container} flex flex-col gap-10 py-section md:py-section-desktop`}>
        <div className={`flex max-w-reading flex-col gap-4 ${soft}`}>
          <p className="text-label font-bold text-fg-brand">{beforeTitle.eyebrow}</p>
          <h2 id="tabs-before-title">
            <span className="text-title-1 font-bold break-keep text-lift md:text-display-3">
              <span className="block text-balance">{beforeTitle.lead}</span>
              <span className="block text-balance text-fg-muted"> {beforeTitle.rest}</span>
            </span>
          </h2>
        </div>
        <BeforeStack post={<CommunityPost />} service={<ServiceWindow />} />
      </div>
    </section>
  );
}
