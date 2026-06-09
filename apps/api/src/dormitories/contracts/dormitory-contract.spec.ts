import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dormitoryContract from '@repo/shared/dormitory';
import * as dormitoryCatalogContract from '@repo/shared/dormitory/catalog';
import * as dormitoryGuideContract from '@repo/shared/dormitory/guide';
import { dormitorySelectionStateSchema } from '@repo/shared/dormitory/enums';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SRC_DIR = path.resolve(CURRENT_DIR, '../../../../../packages/shared/src');
const SHARED_PACKAGE_JSON_PATH = path.resolve(
  CURRENT_DIR,
  '../../../../../packages/shared/package.json',
);

describe('dormitory shared contract', () => {
  it('dormitory canonical barrel은 granular catalog/guide/enums schema surface를 제공한다', () => {
    expect(dormitoryContract.dormitorySelectionStateSchema).toBe(dormitorySelectionStateSchema);
    expect(dormitoryContract.dormitoryListResponseSchema).toBe(
      dormitoryCatalogContract.dormitoryListResponseSchema,
    );
    expect(dormitoryContract.dormitoryGuideResponseSchema).toBe(
      dormitoryGuideContract.dormitoryGuideResponseSchema,
    );
    expect(dormitorySelectionStateSchema.parse('SELECTED')).toBe('SELECTED');
    expect(dormitorySelectionStateSchema.parse('ASSIGNED')).toBe('ASSIGNED');
    expect(dormitorySelectionStateSchema.safeParse('UNKNOWN').success).toBe(false);
  });

  it('dormitory catalog/guide response shape를 유지한다', () => {
    expect(
      dormitoryCatalogContract.dormitoryListResponseSchema.parse({
        campus: {
          code: 'CHUNCHEON',
          nameKo: '춘천캠퍼스',
          isOperated: true,
        },
        items: [
          {
            id: 'dasan',
            name: '다산관',
            roomType: 2,
            genderPolicy: 'M',
            isOperated: true,
          },
        ],
      }),
    ).toMatchObject({ items: [{ id: 'dasan', roomType: 2 }] });

    expect(
      dormitoryGuideContract.dormitoryGuideResponseSchema.parse({
        dormitory: {
          id: 'dasan',
          name: '다산관',
          roomType: 2,
        },
        guide: {
          bathroomType: 'SHARED',
          facilities: ['laundry'],
          repairContact: '033-000-0000',
          diningContact: null,
        },
        commonRules: [{ emoji: '🧹', label: '청소', value: '주 1회' }],
        emergencyContacts: [{ label: '행정실', value: '033-111-1111' }],
        homepageUrl: 'https://example.com',
      }),
    ).toMatchObject({
      dormitory: { id: 'dasan', roomType: 2 },
      guide: { bathroomType: 'SHARED' },
    });
  });

  it('dormitory legacy root/compat files를 남기지 않는다', () => {
    for (const legacyRootFile of [
      'dormitory-contract.ts',
      'dormitory-contract-enums.ts',
      'dormitory-contract-list.ts',
      'dormitory-contract-guide.ts',
      'compat/dormitory-contract.ts',
    ]) {
      expect(existsSync(path.join(SHARED_SRC_DIR, legacyRootFile))).toBe(false);
    }
  });

  it('dormitory package exports는 canonical granular subpath만 제공한다', () => {
    const packageJson = JSON.parse(readFileSync(SHARED_PACKAGE_JSON_PATH, 'utf8')) as {
      exports: Record<string, { types: string; default: string }>;
    };

    expect(packageJson.exports['./dormitory-contract']).toBeUndefined();
    expect(packageJson.exports['./dormitory']).toEqual({
      types: './dist/dormitory/index.d.ts',
      default: './dist/dormitory/index.js',
    });
    expect(packageJson.exports['./dormitory/enums']).toEqual({
      types: './dist/dormitory/enums.d.ts',
      default: './dist/dormitory/enums.js',
    });
    expect(packageJson.exports['./dormitory/catalog']).toEqual({
      types: './dist/dormitory/catalog.d.ts',
      default: './dist/dormitory/catalog.js',
    });
    expect(packageJson.exports['./dormitory/guide']).toEqual({
      types: './dist/dormitory/guide.d.ts',
      default: './dist/dormitory/guide.js',
    });
  });
});
