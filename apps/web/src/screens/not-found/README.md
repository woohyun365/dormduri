# Not found

`apps/web/src/screens/not-found`는 이 사이트에 없는 주소의 화면을 소유합니다. route 파일(`src/app/not-found.tsx`)은 공개 entry
`index.ts`의 `NotFoundScreen`만 렌더링합니다. 화면 계층 공통 규칙(구조, import, lint, token)은 [새 화면 계층 README](../README.md)를
따릅니다.

## 제품 책임

- 없는 주소에 한국어로 무엇이 일어났는지 알리고 돌아갈 길(홈으로·이전 화면으로)을 줍니다. 홈은 로그인 여부와 관계없이 `/`입니다.
- 응답 코드는 404입니다. Next가 404 응답에 `noindex`를 넣으므로 이 화면은 검색 색인에 오르지 않습니다.
- 로그인 여부를 읽지 않고, 다른 route의 `notFound()` 호출도 이 화면이 정하지 않습니다.

## 화면

- 흰 배경의 밝은 판(`data-palette="light"`): 위에 로고(홈 `/` 링크), 제목, 한 줄 안내, 단추 둘입니다.
- 단추는 각진 차분한 모양입니다(`@/screens/ui/controls`의 `controlButton`·`quietButton`, 법적 문서 화면과 같음). 홈으로는 테두리
  단추, 이전 화면으로는 글자 단추입니다.
- 문구는 해요체입니다(`model/notFoundCopy.ts`, [fe.ds.copy-style](../../../../../docs/architecture/decisions/fe.md#fedscopy-style)). test는
  문구를 글자로 고정하지 않고 이 상수를 가져옵니다.
- 이전 화면으로는 바로 앞 방문 기록이 같은 사이트일 때만 뒤로 가고, 주소를 직접 열었거나 바깥 link·새 탭이면 홈으로 갑니다. Navigation
  API가 있는 브라우저는 그 기록 목록(같은 사이트의 이어진 기록만 담김)으로 직접 보고, 없으면 처음 열린 주소와 referrer로 짐작합니다.
  판단은 `src/screens/ui/model/backTarget.ts`의 순수 함수이고 `src/screens/ui/__tests__/backTarget.test.ts`가 경우를 고정합니다.
  법적 문서 화면도 같은 단추를 쓰고, 두 문서 주소를 같은 자리로 넘깁니다.
- 이전 화면으로는 client 부품이라 JavaScript가 돌기 전에는 동작하지 않습니다. 바로 옆 홈으로 link는 늘 동작합니다.

## client 부품

Next는 root `not-found` 파일이 import한 client 부품을 모든 page와 함께 내려받습니다. 그래서 client 부품은 이전 화면으로 단추
(`src/screens/ui/controls/BackButton.tsx`) 하나만 두고 Next router 대신 브라우저 history·location을 씁니다. 로고(`@/screens/ui/brand`)는 그림을
`getImageProps`로 server에서 그려 `next/image` 부품의 client code를 이 묶음에 넣지 않습니다. 홈 link도 `next/link` 대신 일반 `<a>`입니다
(404에서 홈으로는 전체 load로 충분). 2026-11-17 측정(gzip, 모든 page): 처음 초안(`next/link`·`next/image` 부품·router) `/` +8.9KB,
`next/link`만 남기면 +3.9KB, 그때 구성 +0.8KB. 2026-11-26 법적 문서 화면이 같은 자리 판단을 더해 모든 page가 약 0.2KB 더
받습니다. client 부품을 더하려면 모든 page의 내려받는 양을 먼저 잽니다(측정 방법은 #913 PR).

## 검사

- e2e `apps/web/e2e/not-found.spec.ts`: 404 응답, 탭 제목, 제목, `noindex`, 홈으로·로고 link, 이전 화면으로의 두 경우.
- route test `apps/web/src/app/__tests__/not-found-route.test.ts`: route 파일이 공개 entry만 import하고 이 화면만 그림
  ([fe.comp.route-entry-import-guard](../../../../../docs/architecture/decisions/fe.md#fecomproute-entry-import-guard)).
- Storybook `NotFound/Page`: 렌더·axe.
