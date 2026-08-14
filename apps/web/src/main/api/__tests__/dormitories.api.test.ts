import { afterEach, describe, expect, it, vi } from 'vitest';
import { dormitoriesApi, DormitoriesApiError } from '../dormitories.api';

const listResponse = {
  campus: { code: 'CHUNCHEON', nameKo: '춘천캠퍼스', isOperated: true },
  items: [{ id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true }],
};

function stubJson(json: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(json), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('dormitoriesApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('catalog를 same-origin BFF에서 조회한다', async () => {
    const listFetch = stubJson(listResponse);
    await expect(dormitoriesApi.getDormitories('CHUNCHEON', 'M')).resolves.toEqual(listResponse);
    expect(listFetch).toHaveBeenCalledWith('/api/dormitories?campus=CHUNCHEON&gender=M', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: undefined,
    });
  });

  it('schema drift를 빈 fallback으로 바꾸지 않고 오류로 반환한다', async () => {
    stubJson({ items: [] });
    await expect(dormitoriesApi.getDormitories('CHUNCHEON')).rejects.toBeInstanceOf(
      DormitoriesApiError,
    );
  });
});
