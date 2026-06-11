import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type FaqArticleRouteContext = BffRouteContext<{ articleId: string }>;

export async function GET(request: NextRequest, context: FaqArticleRouteContext) {
  const { articleId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    method: 'GET',
    path: `/api/support/faq/${encodeBffPathSegment(articleId)}`,
  });
}
