import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { GET as getDormitories } from '../dormitories/route';
import { GET as getDormitoryGuide } from '../dormitories/[dormitoryId]/guide/route';

const listResponse = {
  campus: { code: 'CHUNCHEON', nameKo: '춘천캠퍼스', isOperated: true },
  items: [{ id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true }],
};
const guideResponse = {
  dormitory: { id: 'dasan', name: '다산관', roomType: 2 },
  guide: {
    bathroomType: 'SHARED',
    facilities: ['세탁실'],
    repairContact: '033-000-0000',
    diningContact: null,
  },
  commonRules: [{ emoji: '🧹', label: '청소', value: '주 1회' }],
  emergencyContacts: [{ label: '행정실', value: '033-111-1111' }],
  homepageUrl: 'https://example.com',
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

  it('guide path를 encode하고 contract drift를 fail closed 처리한다', async () => {
    const fetchMock = stubJsonFetch(guideResponse);
    const response = await getDormitoryGuide(createBffRequest('/api/dormitories/dasan/guide'), {
      params: { dormitoryId: 'dasan/별관' },
    });
    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/dormitories/dasan%2F%EB%B3%84%EA%B4%80/guide',
    );
    await expect(response.json()).resolves.toEqual(guideResponse);

    vi.unstubAllGlobals();
    stubJsonFetch({ dormitory: { id: 'dasan' } });
    const invalid = await getDormitoryGuide(createBffRequest('/api/dormitories/dasan/guide'), {
      params: { dormitoryId: 'dasan' },
    });
    expect(invalid.status).toBe(502);
    await expect(invalid.json()).resolves.toMatchObject({ code: 'BFF_UPSTREAM_SCHEMA_INVALID' });
  });
});
