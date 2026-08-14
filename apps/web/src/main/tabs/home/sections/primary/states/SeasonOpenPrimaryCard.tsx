import { PrimaryCardFrame } from '../PrimaryCardFrame';
import type { PrimaryContent } from '../model/primaryTypes';

interface SeasonOpenPrimaryCardProps {
  content: PrimaryContent;
}

export function SeasonOpenPrimaryCard({ content }: SeasonOpenPrimaryCardProps) {
  return <PrimaryCardFrame content={content} suppressActions />;
}
