import {
  dormitoryGuideResponseSchema,
  dormitoryListResponseSchema,
  type DormitoryGuideResponse,
  type DormitoryListResponse,
} from '@repo/shared/dormitory';
import type { Campus, Gender } from '@repo/shared/identity/primitives';

export class DormitoriesApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'DormitoriesApiError';
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new DormitoriesApiError('기숙사 응답을 해석하지 못했어요.', response.status);
  }
}

interface DormitoryRequestOptions {
  readonly signal?: AbortSignal;
}

async function getDormitories(
  campus: Campus,
  gender?: Gender,
  options: DormitoryRequestOptions = {},
): Promise<DormitoryListResponse> {
  const query = new URLSearchParams({ campus });
  if (gender) query.set('gender', gender);

  let response: Response;
  try {
    response = await fetch(`/api/dormitories?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: options.signal,
    });
  } catch {
    throw new DormitoriesApiError('기숙사 목록을 불러오지 못했어요.');
  }

  if (!response.ok) {
    throw new DormitoriesApiError('기숙사 목록을 불러오지 못했어요.', response.status);
  }
  const parsed = dormitoryListResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new DormitoriesApiError('기숙사 목록 형식이 올바르지 않아요.');
  return parsed.data;
}

async function getDormitoryGuide(
  dormitoryId: string,
  options: DormitoryRequestOptions = {},
): Promise<DormitoryGuideResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/dormitories/${encodeURIComponent(dormitoryId)}/guide`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: options.signal,
    });
  } catch {
    throw new DormitoriesApiError('기숙사 안내를 불러오지 못했어요.');
  }

  if (!response.ok) {
    throw new DormitoriesApiError('기숙사 안내를 불러오지 못했어요.', response.status);
  }
  const parsed = dormitoryGuideResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new DormitoriesApiError('기숙사 안내 형식이 올바르지 않아요.');
  return parsed.data;
}

export const dormitoriesApi = { getDormitories, getDormitoryGuide };
