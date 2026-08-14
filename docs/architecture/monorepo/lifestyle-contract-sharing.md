# Lifestyle contract 공유 경계

**상태**: Accepted / current

## 결정

FE와 API가 함께 해석해야 하는 lifestyle enum, runtime schema, TypeScript type은 `packages/shared`의 Zod
contract로 소유한다. 앱별 UX 문구, persistence mapping, domain error는 공유하지 않는다.

## 공유 범위

| 공유                     | 앱별 소유                     |
| ------------------------ | ----------------------------- |
| lifestyle field enum     | Form layout와 사용자 문구     |
| strict runtime schema    | API error mapping             |
| inferred TypeScript type | Prisma column mapping         |
| 교차 필드 불변식         | 공개 범위와 action capability |

## 현재 경계

- Shared schema: `packages/shared/src/lifestyle/schema.ts`
- Shared exports: `packages/shared/src/lifestyle/index.ts`
- API persistence mapping: `apps/api/src/season-participants/lifestyle/lifestyle-persistence.mapper.ts`
- Public profile projection: `packages/shared/src/profile/contract/`

## 선택 근거

- 동일한 enum과 교차 규칙을 FE/BE에 중복하면 contract drift가 발생한다.
- Zod는 runtime validation과 TypeScript inference를 같은 정의에서 제공한다.
- Nest/Prisma/Web 전용 책임까지 shared로 올리면 package가 application layer를 소유하게 되므로 제외한다.
