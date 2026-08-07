import { globalNoticeDetailResponseSchema } from '@repo/shared/notices';
import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardValidatedBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type NoticeDetailRouteContext = BffRouteContext<{ noticeId: string }>;

export async function GET(request: NextRequest, context: NoticeDetailRouteContext) {
  const { noticeId } = await resolveBffRouteParams(context);
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: `/api/notices/${encodeBffPathSegment(noticeId)}`,
    operation: 'notice.detail',
    responseSchema: globalNoticeDetailResponseSchema,
  });
}
