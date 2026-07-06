import { PrimaryCardFrame } from '../PrimaryCardFrame';
import type { PrimaryContent } from '../model/primaryTypes';

interface OffSeasonPrimaryCardProps {
  content: PrimaryContent;
}

export function OffSeasonPrimaryCard({ content }: OffSeasonPrimaryCardProps) {
  return <PrimaryCardFrame content={content} />;
}
