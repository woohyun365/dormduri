import { PrimaryCardFrame } from '../PrimaryCardFrame';
import type { PrimaryContent } from '../model/primaryTypes';

interface PostMatchPrimaryCardProps {
  content: PrimaryContent;
}

export function PostMatchPrimaryCard({ content }: PostMatchPrimaryCardProps) {
  return <PrimaryCardFrame content={content} />;
}
