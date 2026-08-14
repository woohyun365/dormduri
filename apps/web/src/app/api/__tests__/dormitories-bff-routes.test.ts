import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { GET as getDormitories } from '../dormitories/route';

const listResponse = {
  campus: { code: 'CHUNCHEON', nameKo: '춘천캠퍼스', isOperated: true },
  items: [{ id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true }],
};
describe('dormitory BFF routes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('catalog query를 public upstream으로 전달하고 contract를 검증한다', async () => {
    const fetchMock = stubJsonFetch(listResponse);
    const response = await getDormitories(
      createBffRequest('/api/dormitories?campus=CHUNCHEON&gender=M'),
    );

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/dormitories?campus=CHUNCHEON&gender=M',
    );
    expect(firstFetchInit(fetchMock)).toMatchObject({ method: 'GET', cache: 'no-store' });
    await expect(response.json()).resolves.toEqual(listResponse);
  });
});
