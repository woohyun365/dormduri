import type { Metadata } from 'next';
import { NotFoundScreen, notFoundCopy } from '@/screens/not-found';
import { SITE_NAME } from './metadata';

// Every address this site does not have. The root segment does not take the root title template, so
// the tab title spells the same `돔두리 | <page>` form out (#706).
export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} | ${notFoundCopy.title}` },
};

export default function NotFound() {
  return <NotFoundScreen />;
}
