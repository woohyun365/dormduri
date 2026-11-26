# Legal

`apps/web/src/screens/legal`은 공개 법적 문서 화면 `/privacy`(개인정보 처리방침)와 `/terms`(이용약관)를 소유합니다. route 파일
(`src/app/{privacy,terms}/page.tsx`·`not-found.tsx`)은 공개 entry `index.ts`만 렌더링합니다. 화면 계층 공통 규칙(구조, import,
lint, token)은 [새 화면 계층 README](../README.md)를 따릅니다. 문서 읽기(공개 열람 API, 마지막 성공본, load 상태)와 가입 동의 화면은
[Web legal](../../legal/README.md)이 소유합니다.

## 제품 책임

- 문서 본문은 게시된 판의 section 그대로입니다. 순서와 글자를 바꾸지 않고 줄이거나 숨기지 않습니다. 접힌 목차는 펼치면 같은
  글자입니다.
- 한 page는 한 판입니다. 시행 중 판은 문서 주소(`/privacy`·`/terms`)에서, 시행 예정 판과 이전 판은
  `?version=<versionKey>`(시행일 `YYYY-MM-DD`)에서 엽니다. 어느 판이 시행 중인지, 무엇이 바뀌었는지는 API가 답하고 화면은 다시
  계산하지 않습니다.
- 비로그인으로 엽니다. route는 요청마다 읽고(`force-dynamic`), load 상태 넷을 화면으로 바꿉니다.

  | load 상태                                            | 화면                                                                                  |
  | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
  | 게시본(`published`)                                  | 문서 화면                                                                             |
  | 마지막으로 확인한 판(`last-success`)                 | 문서 화면과 맨 위 status 안내(확인 시각, KST)                                         |
  | 없는 판(`version-not-found`, 판 주소)                | HTTP 404와 없는 판 화면. route가 `notFound()`를 부르고 segment `not-found.tsx`가 그림 |
  | 불러올 수 없음(그 밖, 지금 판 주소의 '없는 판' 포함) | 문서 없음 화면                                                                        |

  빈 화면은 내지 않습니다(처리방침 지속 게재). 판 주소가 아닌 지금 판 주소에서 '없는 판'이 오면 '지금 판 보기'가 자기 주소로 돌지
  않게 문서 없음 화면을 냅니다.

- 보인 문서에는 사용자 문구가 아닌 출처 표시 `<span hidden data-dormduri-legal-source="published|last-success">`가 있습니다. Web
  배포 smoke(`infra/deploy/user/ssm/deploy.sh`)는 두 문서가 `published`일 때만 새 Web을 남깁니다. 메시지 화면(없는 판·문서 없음)에는
  출처 표시가 없습니다.

## 화면

- 흰 배경의 밝은 판(`components/LegalFrame.tsx`, `data-palette="light"`)이고 A4 문서처럼 읽힙니다.
- shell(`components/shell/`): header에 로고(홈 `/`, 이 화면의 유일한 홈 link), 두 문서 전환, '이전 화면으로'를 둡니다. 두 문서
  전환은 방문 기록을 바꾸므로(replace) '이전 화면으로'와 브라우저 뒤로 가기는 Legal에 들어오기 전 화면으로 갑니다. '이전 화면으로'는
  두 문서 주소를 같은 자리로 넘기고(`@/screens/ui/controls`의 `BackButton`), 직접 열었거나 외부에서 왔으면 홈으로 갑니다. header는
  lg부터 붙고 그 아래에서는 스크롤로 사라집니다. footer는 문의 주소와 독립 서비스 고지 한 줄입니다.
- 순서: 안내(다른 판·새 판 공지·마지막으로 확인한 판) → 제목·서문·시행일·최종 수정일·변경 요약·주요 내용·문서 도구 → 목차 → 본문
  → 이전 판과 달라진 조항 → 적용 기간과 이전 판. lg부터 목차는 오른쪽 rail(sticky)이고, 그 아래에서는 서문 뒤에 접혀 있습니다.
- 안내: 시행 중 판 화면은 새 판이 공지되어 있으면 '새 판 공지'와 그 판 link를 냅니다. 시행 예정 판·이전 판 화면은 맨 위에 그 판이
  무엇인지 알리고 '지금 판 보기'를 둡니다.
- 조항 대조표(`components/VersionComparison.tsx`): 바뀐·더한·뺀 조항만 원래 순서로 싣고, 조항마다 '이전 판'·'이 판' 두 칸을 둡니다
  (lg부터 좌우). 칸 안은 본문과 같은 renderer이고 heading 단계를 절 h2 아래로 내리며 목차에 넣지 않습니다. 바뀐 조항이 없으면
  한 줄, 첫 판이면 절이 없고, 불러올 수 없으면 안내 한 줄이며 문서는 그대로 냅니다. 변경 요약 안 '달라진 조항 보기'가 절로 갑니다.
- 적용 기간과 이전 판(`components/VersionHistory.tsx`): 줄마다 상태와 기간이 있습니다. 지금 보는 판은 표시만 하고 나머지는 그 판
  주소로 가는 '보기' link입니다.
- 목차 이동은 방문 기록을 쌓지 않고(`replaceState`) 주소 #만 바꾸며 그 heading에 focus를 둡니다. 주소 #로 열면 load와 글꼴 뒤에 한
  번 더 맞춥니다. lg에서 heading은 sticky header 아래에 옵니다.
- 표는 화면보다 넓으면 자기 영역 안에서만 가로로 스크롤하고, 넘칠 때만 keyboard focus를 받습니다(`components/ScrollRegion.tsx`).
- 인쇄하면 header·footer·목차를 숨기고 본문 전체를 냅니다. 문서 도구는 인쇄하기와 링크 복사입니다.
- 안내·주의 callout과 화면 안내는 색만이 아니라 굵은 글 label로 구분합니다.
- motion은 rail에서 화면에 보이는 조를 표시하는 색 전환(150ms, `motion-safe`) 하나입니다. 등장 효과는 없습니다. 150ms가 duration
  token 밖인 이유는 [Motion 문서](../../styles/tokens/__stories__/Motion.mdx)에 있습니다.

## 문구 규칙

- 화면 문구와 접근성 이름은 `model/legalScreenCopy.ts` 상수입니다. test는 글자를 고정하지 않고 이 상수를 가져옵니다.
- 문구는 문서 본문과 같은 합니다체입니다. 한 화면이 한 문서이고 판의 효력을 알리는 안내가 법적 고지이기 때문입니다
  ([fe.ds.copy-style](../../../../../docs/architecture/decisions/fe.md#fedscopy-style)의 법적 문서 화면 예외).
- 처리방침 이름은 법정 명칭 "개인정보 처리방침"입니다(header link, `/privacy` 탭 제목, [LB-R1](../../../../../docs/policies/legal-basis.md)).
  header의 처리방침 link는 이용약관 link보다 굵습니다. 이 두 글자는 test가 글자로 고정합니다
  ([fe.ds.copy-authority](../../../../../docs/architecture/decisions/fe.md#fedscopy-authority)).
- 사용자 문구에 plan·issue·내부 경로·raw id·판 key·내부 상태 이름을 쓰지 않습니다. 판 key는 주소에만 씁니다. 날짜는
  `@/screens/ui/model/legalDates`의 '2026년 11월 20일' 표기이고, 확인 시각은 KST '2026년 11월 25일 18:30'입니다.
- 문의 주소와 독립 서비스 고지는 Landing과 함께 쓰는 원본 `src/screens/ui/model/serviceNotices.ts`에서 가져옵니다.

## 입력과 model

- 화면 입력은 공개 열람 계약(`@repo/shared/legal`)입니다.
  - `page`: `/page` 답. 보이는 판, 판 목록, 공지된 새 판
  - `source`: `published`, 또는 `last-success`와 확인 시각
  - `comparison`: `/comparison` 답. 읽지 못하면 `null`
- `model/legalDocumentModel.ts`는 이 입력을 화면 model로 바꾸는 순수 함수입니다(본문 block과 heading id, 목차, 판 목록 줄, 안내,
  대조표 상태). 판 주소는 `src/screens/ui/model/legalAddress.ts`가 Landing 개정 예고 띠와 함께 만듭니다.
- 이 화면의 제품 파일은 `@/legal/**`(옛 화면·data 읽기)을 import하지 않습니다(`legal-document-boundary.spec.ts`).

## client 부품

client 부품은 문서 도구(`DocumentActions`), 표 영역(`ScrollRegion`), 목차(`Toc`, `useVisibleHeadings`), 주소 # 맞춤
(`InitialHashJump`), 대조표 link(`HeadingLink`)와 `@/screens/ui/controls`의 '이전 화면으로'입니다. 나머지는 server에서 그립니다.
React Compiler는 이 디렉터리의 component를 모두 compile합니다(건너뜀 0, 2026-11-26 파일별 기록).

## Storybook

`Legal/Page` story 18개가 두 문서의 상태를 모두 보입니다.

- 기본, 마지막으로 확인한 판, 새 판 공지
- 시행 예정 판 보기, 이전 판 보기, 대조표 불러올 수 없음
- 없는 판, 문서 없음, section 종류 견본

입력은 `__stories__/storyDocuments.ts`가 개발 seed(`@/legal/test-support/`, story·test만 import)로 만든 계약 모양이고, 공유 schema로
parse합니다. 시행 예정 처리방침은 seed의 첫 개정 초안입니다. seed에 이용약관 판이 하나라서, 이용약관의 시행 예정·이전 판은 같은
본문에 날짜만 바꾼 표시용 견본입니다. section 종류 견본(`__stories__/sectionKindSample.ts`)은 render 범위용 짧은 글입니다.
story 안 link는 `__stories__/storyLinks.tsx`가 그 주소를 보이는 story로 이어 줍니다(Storybook 전용).

## 검사

| 무엇                                                                                                                                       | 어디                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 입력 → 화면 model(본문 보존, 목차, 판 목록, 안내, 대조표, 문구)                                                                            | `model/legalDocumentModel.test.ts`                                   |
| 화면(본문·대조표 글자, h1, 읽는 순서, 목차, label, 날짜, 판 목록, 안내, 대조표 상태, 인쇄·링크 복사, 메시지 화면, header, 로고, 출처 표시) | `__tests__/LegalDocumentScreen.test.tsx`                             |
| route(공개 entry import, load 상태별 화면, `notFound()`, 탭 제목)                                                                          | `src/app/__tests__/legal-routes.test.tsx`                            |
| 옛 화면 부품 import 없음, `force-dynamic`                                                                                                  | `src/legal/__tests__/legal-document-boundary.spec.ts`                |
| '이전 화면으로' 판단, 판 주소·날짜                                                                                                         | `src/screens/ui/__tests__/backTarget.test.ts`·`legalAddress.test.ts` |
| 흐름: 문서 전환과 돌아가기, 목차 이동, 좁은 화면·320px·인쇄, 없는 판 404, load 상태                                                        | `apps/web/e2e/legal.spec.ts`(Web-only, 마지막 성공본 fixture)        |
| API 게시본, 판 목록·대조표                                                                                                                 | `apps/web/e2e/legal.fullstack.spec.ts`(local, Docker)                |
| 렌더·axe, heading·callout label 계산 style                                                                                                 | `apps/web/e2e/storybook/stories.storybook.ts`·`legal.storybook.ts`   |
