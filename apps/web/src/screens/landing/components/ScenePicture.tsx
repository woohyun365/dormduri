import { getImageProps, type StaticImageData } from 'next/image';

// A section background picture (hero and closing). The scrim is an ellipse that darkens toward the
// middle, where the centered copy sits, so the bears at the edges stay brighter than the copy's
// background. The hero adds an even 30% base, the lightest that keeps every hero line over the picture
// at 4.5:1 (3:1 large) across the contrast sweep of phone, tablet, laptop and narrow window sizes.
// Only the cut matching `media` loads (art direction with getImageProps, no preload). The hero picture
// is the first screen's largest image, so it loads eagerly at high priority and moves (settles in,
// drifts with the scroll; reduced motion keeps it still); the closing one loads lazily and stays still.
export function ScenePicture({
  art,
  media,
  hero = false,
}: {
  art: { wide: StaticImageData; tall: StaticImageData };
  media: string;
  hero?: boolean;
}) {
  const common = {
    alt: '',
    sizes: '100vw',
    loading: hero ? 'eager' : 'lazy',
    fetchPriority: hero ? 'high' : 'auto',
  } as const;
  const wide = getImageProps({ ...common, src: art.wide }).props.srcSet;
  const { srcSet: tallSet, ...tall } = getImageProps({ ...common, src: art.tall }).props;
  return (
    <>
      <div aria-hidden="true" className={`absolute inset-0 -z-20 ${hero ? 'media-drift' : ''}`}>
        <picture className="block size-full">
          <source media={media} srcSet={wide} />
          <img
            {...tall}
            alt=""
            srcSet={tallSet}
            className={`size-full object-cover object-bottom ${hero ? 'media-settle' : ''}`}
          />
        </picture>
      </div>
      {hero ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-media-scrim/30" />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-radial from-media-scrim/60 from-50% to-transparent to-85%"
      />
    </>
  );
}
