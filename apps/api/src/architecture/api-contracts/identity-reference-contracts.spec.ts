import { campusMetaSchema } from '@repo/shared/campus';
import { campusSchema, genderSchema } from '@repo/shared/identity/primitives';

describe('identity reference contract', () => {
  it('campus/gender primitives와 campus metadata schema를 canonical nested path에서 제공한다', () => {
    expect(campusSchema.parse('CHUNCHEON')).toBe('CHUNCHEON');
    expect(campusSchema.safeParse('WONJU').success).toBe(false);
    expect(genderSchema.parse('M')).toBe('M');
    expect(genderSchema.safeParse('UNKNOWN').success).toBe(false);

    expect(
      campusMetaSchema.parse({
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      }),
    ).toEqual({ code: 'CHUNCHEON', nameKo: '춘천캠퍼스', isOperated: true });
  });
});
