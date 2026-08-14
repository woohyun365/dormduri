import { PrimaryCardFrame } from '../PrimaryCardFrame';
import type { PrimaryContent } from '../model/primaryTypes';

interface SeasonMatchingPrimaryCardProps {
  content: PrimaryContent;
}

export function SeasonMatchingPrimaryCard({ content }: SeasonMatchingPrimaryCardProps) {
  return <PrimaryCardFrame content={content} suppressActions={Boolean(content.steps?.length)} />;
}
