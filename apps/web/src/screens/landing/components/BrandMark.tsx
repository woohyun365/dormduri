import Image from 'next/image';
import { landingCopy } from '../model/landingCopy';
import { logoMarks, type LogoTone } from './sceneArt';

// The service mark beside the service name, which stays text; the mark itself is decorative.
// width/height are the drawn size in px for next/image; size-7/size-8 set the same size in CSS.
export function BrandMark({ tone, large = false }: { tone: LogoTone; large?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-body font-bold whitespace-nowrap">
      <Image
        src={logoMarks[tone]}
        alt=""
        width={large ? 32 : 28}
        height={large ? 32 : 28}
        className={large ? 'size-8' : 'size-7'}
      />
      {landingCopy.serviceName}
    </span>
  );
}
