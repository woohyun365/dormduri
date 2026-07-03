export class HomeActiveMatchActionError extends Error {
  constructor(
    public readonly code:
      | 'HOME_ACTIVE_MATCH_ACTION_REQUEST_FAILED'
      | 'HOME_ACTIVE_MATCH_ACTION_UPSTREAM_UNAVAILABLE',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HomeActiveMatchActionError';
  }
}

async function postActiveMatchUnmatchAction(
  activeMatchId: string,
  action: 'request' | 'cancel',
): Promise<void> {
  const suffix = action === 'cancel' ? '/cancel' : '';
  let response: Response;

  try {
    response = await fetch(
      `/api/matches/active/${encodeURIComponent(activeMatchId)}/unmatch-request${suffix}`,
      { method: 'POST' },
    );
  } catch {
    throw new HomeActiveMatchActionError(
      'HOME_ACTIVE_MATCH_ACTION_UPSTREAM_UNAVAILABLE',
      '매칭 해제 요청을 처리하지 못했어요.',
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new HomeActiveMatchActionError(
      'HOME_ACTIVE_MATCH_ACTION_REQUEST_FAILED',
      payload?.message ?? '매칭 해제 요청을 처리하지 못했어요.',
      response.status,
    );
  }
}

export const homeActiveMatchApi = {
  requestUnmatch: (activeMatchId: string) => postActiveMatchUnmatchAction(activeMatchId, 'request'),
  cancelUnmatchRequest: (activeMatchId: string) =>
    postActiveMatchUnmatchAction(activeMatchId, 'cancel'),
};
