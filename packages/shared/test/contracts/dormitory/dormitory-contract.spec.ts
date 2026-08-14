import { describe, expect, it } from 'vitest';
import * as dormitoryContract from '@repo/shared/dormitory';
import * as dormitoryCatalogContract from '@repo/shared/dormitory/catalog';
import { dormitorySelectionStateSchema } from '@repo/shared/dormitory/enums';

describe('dormitory shared contract', () => {
  it('dormitory canonical barrel은 granular catalog/enums schema surface를 제공한다', () => {
    expect(dormitoryContract.dormitorySelectionStateSchema).toBe(dormitorySelectionStateSchema);
    expect(dormitoryContract.dormitoryListResponseSchema).toBe(
      dormitoryCatalogContract.dormitoryListResponseSchema,
    );
    expect(dormitorySelectionStateSchema.parse('SELECTED')).toBe('SELECTED');
    expect(dormitorySelectionStateSchema.parse('ASSIGNED')).toBe('ASSIGNED');
    expect(dormitorySelectionStateSchema.safeParse('UNKNOWN').success).toBe(false);
  });

  it('dormitory catalog response shape를 유지한다', () => {
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
  });
});
