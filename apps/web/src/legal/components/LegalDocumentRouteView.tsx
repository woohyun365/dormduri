import type { Route } from 'next';
import type { LegalDocumentPageResponse } from '@repo/shared/legal';
import { toLegalDocumentViewModel } from '../api/legal-document.mapper';
import type { LegalLoadResult } from '../model/legal-document.types';
import { LegalDocumentLayout } from './LegalDocumentLayout';
import { LegalDocumentUnavailable } from './LegalDocumentUnavailable';

interface LegalDocumentRouteViewProps {
  result: LegalLoadResult<LegalDocumentPageResponse>;
  /** The route of the version in effect (`/privacy`, `/terms`). */
  currentDocumentHref: Route;
}

/**
 * The `/privacy`·`/terms` screen for each load state. A shown document carries a source mark that is not user copy:
 * the Web deploy smoke (infra/deploy/user/ssm/deploy.sh) keeps a new Web only when both routes are marked `published`.
 * A screen that replaces this one keeps the same mark.
 */
export function LegalDocumentRouteView({
  result,
  currentDocumentHref,
}: LegalDocumentRouteViewProps) {
  if (result.status === 'unavailable' || result.status === 'version-not-found') {
    return (
      <LegalDocumentUnavailable reason={result.status} currentDocumentHref={currentDocumentHref} />
    );
  }

  return (
    <>
      <span hidden data-dormduri-legal-source={result.status} />
      <LegalDocumentLayout
        document={toLegalDocumentViewModel(result.data.viewing)}
        source={
          result.status === 'published'
            ? { kind: 'published' }
            : { kind: 'last-success', checkedAt: result.checkedAt }
        }
      />
    </>
  );
}
