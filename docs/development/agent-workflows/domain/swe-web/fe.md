# Domain/SWE/Web/FE

[Domain/SWE/Web pack](./README.md)의 FE layer입니다. Browser에 보이는 화면과 그 상태·부품·접근성을 다룹니다. 하위 layer마다
상속, 결정 목록, 구현 지침(기준 항목 인용), 검증 기준(항목 id), 위험, binding 키를 둡니다.

## rendering-boundary

`Domain/SWE/Web/FE/rendering-boundary`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### fe.arch.rendering-style

- 수준: `architecture-style`
- 질문: 화면을 server가 만든 HTML 중심으로 할까, browser에서 돌아가는 앱(single-page app) 중심으로 할까?
- 선택지:
  - server-rendered: server가 화면을 만들어 보낸다. 첫 화면이 빠르고 비밀값이 server에 남지만, 상호작용이 많은 부분은 따로 client로 나눠야 한다
  - browser app: browser가 화면 전체를 그린다. 상호작용과 offline 동작이 쉽지만, 첫 화면이 늦고 data 경로와 인증을 browser에서 다뤄야 한다. 상호작용이 없는 화면까지 browser에서 그리므로 연결된 기준 항목 `web-fe-rendering-boundary.md F1`이 결함으로 본다
  - route별 혼합: 화면마다 고른다. 유연하지만 경계 규칙이 늘어 팀이 일관되게 지키기 어렵다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. rendering 방식과 data 경로 전체를 다시 쓴다
- 기본값: server-rendered. 첫 화면이 빠르고 비밀값이 browser로 새지 않는다. 이 기본값은 버리지 않는다. 상호작용이 많은 화면도 상호작용이 필요한 부분만 client로 나눈다(`web-fe-rendering-boundary.md F1`)
- 확인 단서: `{{binding:stack.fe-framework}}`, `{{binding:repo-structure.fe-routes}}`의 route 파일 구조
- 기준 항목: [web-fe-rendering-boundary.md F1](../../review-criteria/web-fe-rendering-boundary.md#f1-serverclient-경계)

#### fe.render.server-client-default

- 수준: `framework-pattern`
- 질문: 화면 부품의 기본 render 위치를 server로 둘까, browser로 둘까?
- 선택지:
  - server-first: 기본은 server에서 그리고 상호작용 부분만 client로 둔다. bundle(browser가 내려받는 code 묶음)이 작고 비밀값이 안전하지만, 경계를 의식하며 부품을 나눠야 한다
  - client-first: 기본은 browser에서 그린다. 익숙하고 상호작용이 쉽지만, bundle이 커지고 server 전용 값이 새기 쉽다. 상호작용이 없는 화면까지 browser에서 그리므로 연결된 기준 항목 `web-fe-rendering-boundary.md F1`이 결함으로 본다
  - route별: route마다 기본을 정한다. 유연하지만 규칙을 문서로 따로 관리해야 한다
- 먼저 정할 결정: `fe.arch.rendering-style`
- 되돌림: `costly`. 경계를 옮기고 data 경로를 고친다
- 기본값: server-first. 첫 화면이 빠르고 비밀값이 browser로 새지 않는다. 상호작용이 대부분인 화면이면 그 화면만 client로 두고 상위 layout은 server에 둔다(`web-fe-rendering-boundary.md F1`)
- 확인 단서: `{{binding:stack.fe-framework}}`의 version, route 파일에서 client 경계 지시문(파일을 browser 쪽 code로 표시하는 선언)을 쓴 비율
- 기준 항목: [web-fe-rendering-boundary.md F1](../../review-criteria/web-fe-rendering-boundary.md#f1-serverclient-경계), [web-fe-rendering-boundary.md F2](../../review-criteria/web-fe-rendering-boundary.md#f2-render-일치와-navigationscroll-소유)

#### fe.render.error-boundary-unit

- 수준: `code-pattern`
- 질문: 화면 일부가 실패할 때 어디까지 대체 화면으로 바꿀까?
- 선택지:
  - route 단위: route마다 대체 화면 하나. 단순하지만 한 영역 실패가 route 전체를 가린다. 따로 실패할 수 있는 영역이 있는 화면이면 연결된 기준 항목 `web-fe-rendering-boundary.md F4`이 결함으로 본다
  - 독립 영역 단위: 따로 실패할 수 있는 영역마다 경계를 둔다. 나머지 화면이 살아 있지만 경계와 test가 늘어난다
  - 전역 하나: 앱 전체에 하나. 가장 단순하지만 작은 실패도 앱 전체를 멈춘다. 연결된 기준 항목 `web-fe-rendering-boundary.md F4`이 결함으로 본다
- 먼저 정할 결정: `fe.render.server-client-default`
- 되돌림: `easy`. 경계를 더하거나 옮긴다
- 기본값: route 단위 + 독립적으로 실패할 수 있는 영역. 한 부분의 오류가 화면 전체를 지우지 않는다. 화면이 작고 영역이 하나면 route 단위만 둔다
- 확인 단서: `{{binding:repo-structure.fe-routes}}`의 오류 경계 파일과 그 test
- 기준 항목: [web-fe-rendering-boundary.md F4](../../review-criteria/web-fe-rendering-boundary.md#f4-부분-실패-격리와-browser-오류-관측)

#### fe.render.e2e-scope

- 수준: `operational`
- 질문: browser를 띄워 화면을 끝까지 지나가는 test(E2E)를 어떤 흐름과 환경에 둘까?
- 선택지:
  - 핵심 흐름 몇 개와 환경 경계: 사용자에게 가장 중요한 흐름 2~3개만 browser로 보고, API server·DB 없이 web 화면만 띄우는 smoke와 API server·DB를 함께 띄우는 full-stack 흐름을 나눠 적는다. 빠르고 덜 깨지지만 나머지 경로는 아래 layer test가 맡는다
  - 화면·영역마다 E2E: 모든 화면과 영역을 browser로 본다. 넓게 보지만 느리고 문구·구조가 바뀔 때마다 깨진다. 연결된 기준 항목 `swe.md S12`가 결함으로 본다
  - E2E 없음: 아래 layer test만 둔다. 가장 빠르지만 layer 사이 연결과 browser 동작(이동·scroll·기기 API)의 회귀를 놓친다
- 먼저 정할 결정: `fe.arch.rendering-style`
- 되돌림: `easy`. E2E 목록과 실행 환경 표시를 바꾼다
- 기본값: 핵심 흐름 몇 개와 환경 경계. layer 사이 연결을 보면서 실행 시간과 깨짐을 줄인다. 흐름 안에서는 역할·이름으로 요소를 찾고 세부 문구를 확인하지 않는다. API server·DB가 필요한 흐름이 완료 조건이면 smoke 통과만으로 끝내지 않고 full-stack 흐름을 둔다
- 확인 단서: `{{binding:tool.e2e}}`의 E2E 목록과 각 E2E가 도는 환경(web 화면만인지 API server·DB까지인지)의 표시
- 기준 항목: [swe.md S6](../../review-criteria/swe.md#s6-보호-test), [swe.md S12](../../review-criteria/swe.md#s12-동작계약을-고정하는-test)

### 구현 지침

- [web-fe-rendering-boundary.md F1](../../review-criteria/web-fe-rendering-boundary.md#f1-serverclient-경계)
- [web-fe-rendering-boundary.md F2](../../review-criteria/web-fe-rendering-boundary.md#f2-render-일치와-navigationscroll-소유)
- [web-fe-rendering-boundary.md F3](../../review-criteria/web-fe-rendering-boundary.md#f3-체감-성능-budget)
- [web-fe-rendering-boundary.md F4](../../review-criteria/web-fe-rendering-boundary.md#f4-부분-실패-격리와-browser-오류-관측)

### 검증 기준

- `web-fe-rendering-boundary.md F1`
- `web-fe-rendering-boundary.md F2`
- `web-fe-rendering-boundary.md F3`
- `web-fe-rendering-boundary.md F4`

### 위험

- server 전용 module·비밀값이 client bundle로 넘어감(F1), server와 client 첫 render 불일치(F2), 측정 없는 최적화(F3), 한 영역 실패로 화면 전체가 멈춤(F4)
- 비가역 선택: `fe.arch.rendering-style`(`one-way`), `fe.render.server-client-default`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:stack.fe-framework}}`: 쓰는 web framework와 그 version
- `{{binding:repo-structure.fe-routes}}`: route·layout·오류 경계 파일의 위치
- `{{binding:tool.e2e}}`: browser E2E 실행 도구와 그 실행 단위

## state-data-cache

`Domain/SWE/Web/FE/state-data-cache`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### fe.state.server-cache-owner

- 수준: `code-pattern`
- 질문: server에서 온 data의 cache를 누가 가질까?
- 선택지:
  - framework fetch cache: framework가 주는 data cache를 쓴다. dependency가 늘지 않지만 무효화 기능이 framework 범위로 제한된다
  - client query library: browser용 data cache library를 쓴다. 자동 갱신·무효화가 풍부하지만 dependency와 학습 비용이 늘어난다
  - 화면별 수동: 화면마다 직접 관리한다. 시작은 쉽지만 같은 data가 화면마다 어긋난다. 연결된 기준 항목 `web-fe-state-data-cache.md F4`이 결함으로 본다
- 먼저 정할 결정: `fe.render.server-client-default`
- 되돌림: `costly`. 조회 hook(화면 부품이 data를 가져다 쓰는 함수)과 무효화 경로를 바꾼다
- 기본값: framework fetch cache. dependency를 늘리지 않는다. 여러 화면이 같은 data를 자주 갱신하면 library를 검토한다(새 dependency는 [swe.md S7](../../review-criteria/swe.md#s7-dependency-도입과-version-의존-동작))
- 확인 단서: `{{binding:repo-structure.fe-features}}`의 조회 hook, lockfile(설치한 package version을 고정한 파일)에 data cache library가 있는지
- 기준 항목: [web-fe-state-data-cache.md F1](../../review-criteria/web-fe-state-data-cache.md#f1-상태-종류와-단일-원천), [web-fe-state-data-cache.md F4](../../review-criteria/web-fe-state-data-cache.md#f4-무효화경쟁identity-전환)

#### fe.state.mutation-feedback

- 수준: `code-pattern`
- 질문: 변경 요청의 결과를 server 확인 전에 먼저 화면에 보여 줄까?
- 선택지:
  - server 확인 뒤 반영: 응답을 받은 뒤 화면을 바꾼다. 화면이 틀린 상태를 보이지 않지만 느리게 느껴질 수 있다
  - optimistic 반영과 rollback: 먼저 바꾸고 실패하면 되돌린다. 빠르게 느껴지지만 rollback·충돌 처리를 만들어야 한다
  - 동작별 혼합: 동작마다 고른다. 체감과 정확성을 맞출 수 있지만 동작마다 판단이 필요하다
- 먼저 정할 결정: `fe.state.server-cache-owner`
- 되돌림: `easy`. 동작마다 바꾼다
- 기본값: server 확인 뒤 반영. 실패·충돌 때 화면이 거짓 상태를 보이지 않는다. 지연이 체감되고 rollback·충돌 의미가 분명한 동작만 optimistic으로 한다
- 확인 단서: 변경 요청 hook의 rollback 처리와 그 test
- 기준 항목: [web-fe-state-data-cache.md F3](../../review-criteria/web-fe-state-data-cache.md#f3-formmutation과-optimistic-반영), [web-fe-state-data-cache.md F4](../../review-criteria/web-fe-state-data-cache.md#f4-무효화경쟁identity-전환)

#### fe.state.runtime-validation

- 수준: `code-pattern`
- 질문: 밖에서 들어온 data(API 응답·URL·browser 저장소)를 어디서 확인할까?
- 선택지:
  - 경계에서 공유 schema로 검증: 들어오는 곳 한 군데에서 걸러 낸다. 화면 code가 단순해지지만 schema를 관리해야 한다
  - 쓰는 곳마다 검증: 필요한 곳에서 확인한다. 빠르게 시작하지만 검증이 흩어지고 빠지기 쉽다. 연결된 기준 항목 `web-fe-state-data-cache.md F6`이 결함으로 본다
  - type 선언만: 실행 중 확인 없이 type만 믿는다. 비용이 없지만 잘못된 data가 화면 깊이 들어온다. 연결된 기준 항목 `web-fe-state-data-cache.md F6`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 경계 helper를 더한다
- 기본값: 경계에서 공유 schema로 검증. 한 곳에서 걸러 화면 code가 단순해진다. 생성된 type이 실행 중 검증을 함께 주면 그것을 쓴다
- 확인 단서: `{{binding:repo-structure.shared-contract}}`의 공유 schema, `{{binding:repo-structure.bff-helpers}}`의 schema 검증
- 기준 항목: [web-fe-state-data-cache.md F6](../../review-criteria/web-fe-state-data-cache.md#f6-외부-입력-신뢰-경계와-client-판단의-한계), [web-bff-server-read-error-privacy-shaping.md B3](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b3-응답-최소화와-upstream-검증)

### 구현 지침

- [web-fe-state-data-cache.md F1](../../review-criteria/web-fe-state-data-cache.md#f1-상태-종류와-단일-원천)
- [web-fe-state-data-cache.md F2](../../review-criteria/web-fe-state-data-cache.md#f2-모든-ui-상태)
- [web-fe-state-data-cache.md F3](../../review-criteria/web-fe-state-data-cache.md#f3-formmutation과-optimistic-반영)
- [web-fe-state-data-cache.md F4](../../review-criteria/web-fe-state-data-cache.md#f4-무효화경쟁identity-전환)
- [web-fe-state-data-cache.md F5](../../review-criteria/web-fe-state-data-cache.md#f5-같은-종류-조회-hook의-계약)
- [web-fe-state-data-cache.md F6](../../review-criteria/web-fe-state-data-cache.md#f6-외부-입력-신뢰-경계와-client-판단의-한계)

### 검증 기준

- `web-fe-state-data-cache.md F1`
- `web-fe-state-data-cache.md F2`
- `web-fe-state-data-cache.md F3`
- `web-fe-state-data-cache.md F4`
- `web-fe-state-data-cache.md F5`
- `web-fe-state-data-cache.md F6`

### 위험

- 같은 data의 원천이 둘이 되어 어긋남(F1), 오류·빈 결과·권한 없음 상태 누락(F2), optimistic 반영 뒤 거짓 상태(F3), 계정 전환 뒤 이전 사용자 data 노출(F4), hook마다 다른 반환 형태(F5), 검증 없는 외부 입력과 client 권한 판단(F6)
- 비가역 선택: `fe.state.server-cache-owner`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:repo-structure.fe-features}}`: 기능별 code(조회 hook 포함)의 위치
- `{{binding:repo-structure.shared-contract}}`: front·back이 함께 쓰는 schema의 위치
- `{{binding:repo-structure.bff-helpers}}`: BFF 공통 helper의 위치

## component-architecture

`Domain/SWE/Web/FE/component-architecture`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### fe.comp.primitive-promotion

- 수준: `code-pattern`
- 질문: 기능 안에서 만든 부품을 언제 앱 공통 부품으로 올릴까?
- 선택지:
  - 두 화면 이상 재사용: 두 곳 이상에서 같은 의미로 쓰일 때 올린다. 성급한 공통화를 막지만 잠시 비슷한 부품이 공존한다
  - 처음부터 공통: 만들 때부터 공통에 둔다. 재사용은 쉽지만 한 화면 요구가 공통 부품에 option으로 쌓인다. 연결된 기준 항목 `web-fe-design-system.md F2`이 결함으로 본다
  - 올리지 않음: 기능 안에만 둔다. 독립적이지만 같은 부품이 여러 벌 생긴다. 연결된 기준 항목 `web-fe-component-architecture.md F1`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 파일을 옮기고 import를 고친다
- 기본값: 두 화면 이상에서 의미·상호작용·상태 계약이 같을 때. 겉모양만 같은 부품을 묶으면 나중에 다시 쪼갠다. 공통 부품 원본이 이미 같은 역할의 부품을 정해 두었으면 한 화면에서 처음 쓰여도 그 부품을 쓴다
- 확인 단서: `{{binding:repo-structure.fe-shared-ui}}`의 부품 수와 사용처
- 기준 항목: [web-fe-component-architecture.md F1](../../review-criteria/web-fe-component-architecture.md#f1-owner-구분과-공통화-기준), [web-fe-design-system.md F2](../../review-criteria/web-fe-design-system.md#f2-부품-재사용과-승격)

#### fe.comp.directory-unit

- 수준: `code-pattern`
- 질문: code를 기능 단위로 모을까, 종류(부품·hook·utility)별로 모을까?
- 선택지:
  - 기능 단위: 한 기능의 파일을 한 디렉터리에 둔다. 함께 바뀌는 파일이 가깝지만 기능 경계를 정해야 한다
  - 종류별: 부품·hook·utility를 종류별 디렉터리에 둔다. 처음엔 단순하지만 한 기능 수정이 여러 디렉터리에 걸친다. 연결된 기준 항목 `web-fe-component-architecture.md F4`이 결함으로 본다
  - 기능 단위 + 앱 공통만 종류별: 기능은 모으고 공통만 종류별로 둔다. 두 장점을 섞지만 공통의 기준이 필요하다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 많은 파일을 옮기고 import·test 경로를 고친다
- 기본값: 기능 단위 + 앱 공통만 종류별. 함께 바뀌는 파일이 한곳에 있다. 이 기본값은 버리지 않는다. 기능이 적어도 기능 디렉터리로 시작한다
- 확인 단서: `{{binding:repo-structure.fe-features}}`의 구조, 다른 기능의 내부 파일을 import하는 곳이 있는지
- 기준 항목: [web-fe-component-architecture.md F4](../../review-criteria/web-fe-component-architecture.md#f4-기능-단위-배치와-공개-entry)

#### fe.comp.renderer-neutral-model

- 수준: `architecture-style`
- 질문: 화면 규칙과 data model을 다른 화면 기술(native app 등)과 함께 쓸 수 있게 나눌까?
- 선택지:
  - renderer 중립 model로 나눔: 규칙과 model을 화면 기술과 무관한 module에 둔다. 규칙을 한 번만 쓰지만 경계 설계가 필요하다
  - 표현과 logic만 분리: 같은 앱 안에서 표시와 logic을 나눈다. 비용이 작지만 다른 renderer는 규칙을 다시 쓴다. 다른 renderer와 규칙을 공유하면 연결된 기준 항목 `web-fe-component-architecture.md F6`이 결함으로 본다
  - 나누지 않음: 표시 부품에 규칙을 둔다. 빠르지만 규칙이 화면마다 흩어진다. 다른 renderer와 규칙을 공유하면 연결된 기준 항목 `web-fe-component-architecture.md F6`이 결함으로 본다
- 먼저 정할 결정: `fe.arch.rendering-style`
- 되돌림: `costly`. model과 contract를 옮긴다
- 기본값: 다른 renderer 계획이 있으면 나눈다. 규칙을 한 번만 쓴다. 계획이 없으면 표현과 logic 분리까지만 한다
- 확인 단서: `{{binding:repo-structure.shared-contract}}`의 공유 model과 import 경계 test
- 기준 항목: [web-fe-component-architecture.md F6](../../review-criteria/web-fe-component-architecture.md#f6-renderer-중립-경계)

#### fe.comp.test-query

- 수준: `code-pattern`
- 질문: component test가 화면의 요소를 무엇으로 찾을까?
- 선택지:
  - 역할·label·접근 가능한 이름 우선: 사용자와 보조 기술(화면 낭독기 등)이 쓰는 역할과 이름으로 찾는다. 이름이 없는 control을 test가 함께 잡지만, 역할·이름으로 표현하기 어려운 상태·구조는 test 전용 표시가 따로 필요하다
  - test 전용 표시 우선: 요소마다 test만 쓰는 표시를 붙여 찾는다. 문구·구조가 바뀌어도 깨지지 않지만, 이름 없는 control을 test가 놓친다. control을 이렇게 찾으면 연결된 기준 항목 `web-fe-accessibility.md F1`이 결함으로 본다
  - 보이는 문자열·DOM 위치: 화면 문자열이나 DOM 구조로 찾는다. 쓰기 쉽지만 문구·구조만 바꿔도 깨진다. 계약이 아닌 문구·구조를 고정하므로 연결된 기준 항목 `swe.md S12`가 결함으로 보고, control을 이렇게 찾으면 `web-fe-accessibility.md F1`도 결함으로 본다
- 먼저 정할 결정: `fe.a11y.baseline`
- 되돌림: `easy`. test의 찾는 방식만 바꾼다
- 기본값: 역할·label·접근 가능한 이름 우선. test가 사용자와 같은 방식으로 요소를 찾아 접근 가능한 이름의 회귀도 잡는다. 역할·이름으로 표현할 수 없는 상태·구조에만 test 전용 표시를 쓴다
- 확인 단서: `{{binding:repo-structure.fe-features}}`·`{{binding:repo-structure.fe-shared-ui}}`의 component test에서 역할·이름으로 찾는 비율과 test 전용 표시를 쓴 곳
- 기준 항목: [web-fe-accessibility.md F1](../../review-criteria/web-fe-accessibility.md#f1-의미-있는-요소와-접근-가능한-이름), [swe.md S12](../../review-criteria/swe.md#s12-동작계약을-고정하는-test)

### 구현 지침

- [web-fe-component-architecture.md F1](../../review-criteria/web-fe-component-architecture.md#f1-owner-구분과-공통화-기준)
- [web-fe-component-architecture.md F2](../../review-criteria/web-fe-component-architecture.md#f2-합성-먼저와-작은-component-api)
- [web-fe-component-architecture.md F3](../../review-criteria/web-fe-component-architecture.md#f3-같이-실행되지-않는-분기-분리)
- [web-fe-component-architecture.md F4](../../review-criteria/web-fe-component-architecture.md#f4-기능-단위-배치와-공개-entry)
- [web-fe-component-architecture.md F5](../../review-criteria/web-fe-component-architecture.md#f5-예시-렌더-표면의-우회-금지)
- [web-fe-component-architecture.md F6](../../review-criteria/web-fe-component-architecture.md#f6-renderer-중립-경계)

### 검증 기준

- `web-fe-component-architecture.md F1`
- `web-fe-component-architecture.md F2`
- `web-fe-component-architecture.md F3`
- `web-fe-component-architecture.md F4`
- `web-fe-component-architecture.md F5`
- `web-fe-component-architecture.md F6`

### 위험

- 기존 부품 재발명과 겉모양 기준 공통화(F1), props 전달과 boolean option 누적(F2), 배타적 분기가 섞인 component(F3), 다른 기능 내부 import(F4), production을 우회하는 예시(F5), renderer에 묶인 공유 model(F6)
- 비가역 선택: 없음. `fe.comp.directory-unit`과 `fe.comp.renderer-neutral-model`은 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.fe-shared-ui}}`: 앱 공통 UI 부품의 위치
- `{{binding:repo-structure.fe-features}}`: 기능별 code의 위치
- `{{binding:repo-structure.shared-contract}}`: 공유 model·schema의 위치
- `{{binding:tool.component-workshop}}`: 부품 예시를 render하는 도구

## design-system

`Domain/SWE/Web/FE/design-system`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.
- 시각 값 자체와 미감 판정은 이 하위 layer에 두지 않습니다.

### 결정 목록

#### fe.ds.token-layer

- 수준: `architecture-style`
- 질문: 색·간격 같은 design 값을 어디에 한 번만 둘까?
- 선택지:
  - semantic token 파일: 의미 이름(본문 글자색 등)의 token을 한 파일에 둔다. 값을 바꿀 때 한 곳만 고치지만 이름 체계가 필요하다
  - framework theme 설정: style 도구의 theme 설정에 둔다. 도구와 잘 맞지만 도구를 바꾸면 함께 옮겨야 한다
  - 화면별 값: 화면마다 값을 쓴다. 빠르지만 값이 흩어져 일관성이 깨진다. 연결된 기준 항목 `web-fe-design-system.md F1`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 모든 style 참조를 바꾼다
- 기본값: semantic token 파일. 값을 바꿀 때 한 곳만 고친다. 값 자체는 시각 기준이 정한다. 이 기본값은 버리지 않는다. 화면에 값을 직접 쓰면 `web-fe-design-system.md F1`이 결함으로 본다. style 도구가 theme 설정을 요구하면 그 설정이 semantic token 파일을 읽게 한다
- 확인 단서: `{{binding:repo-structure.fe-styles}}`의 token 파일과 theme 연결
- 기준 항목: [web-fe-design-system.md F1](../../review-criteria/web-fe-design-system.md#f1-semantic-token만-사용)

#### fe.ds.copy-authority

- 수준: `policy`
- 질문: 화면 문구의 원본을 어디에 둘까?
- 선택지:
  - 정책·승인된 content 원본: 정책 사실은 정책 문서에서, 나머지는 승인된 content 원본에서 가져온다. 화면이 정책과 어긋나지 않지만 원본 관리가 필요하다
  - design 초안: design 도구의 문구를 그대로 쓴다. 빠르지만 예시 문구가 제품 사실처럼 굳는다. 연결된 기준 항목 `web-fe-design-system.md F3`이 결함으로 본다
  - code 안에 직접: 개발자가 쓴다. 빠르지만 정책과 어긋나도 알기 어렵다. 연결된 기준 항목 `web-fe-design-system.md F3`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 문구 출처를 표시하고 옮긴다
- 기본값: 정책·법적 사실은 정책 원본, 나머지는 승인된 content 원본. 화면이 정책과 다른 말을 하지 않는다. 문구의 값은 정책이 소유한다. 이 기본값은 버리지 않는다. 원본이 없는 문구는 지어내지 않고 승인을 받는다(`web-fe-design-system.md F3`)
- 확인 단서: `{{binding:policy.index}}`의 정책 문서, 문구 상수의 위치
- 기준 항목: [web-fe-design-system.md F3](../../review-criteria/web-fe-design-system.md#f3-사용자-문구-권한)

### 구현 지침

- [web-fe-design-system.md F1](../../review-criteria/web-fe-design-system.md#f1-semantic-token만-사용)
- [web-fe-design-system.md F2](../../review-criteria/web-fe-design-system.md#f2-부품-재사용과-승격)
- [web-fe-design-system.md F3](../../review-criteria/web-fe-design-system.md#f3-사용자-문구-권한)

### 검증 기준

- `web-fe-design-system.md F1`
- `web-fe-design-system.md F2`
- `web-fe-design-system.md F3`

### 위험

- raw 값과 화면별 theme(F1), 공통 부품 재발명과 성급한 승격(F2), 원본 없는 사실 문구(F3)
- 비가역 선택: 없음. `fe.ds.token-layer`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.fe-styles}}`: token과 전역 style의 위치
- `{{binding:repo-structure.fe-screens}}`: token을 쓰는 화면 계층의 위치
- `{{binding:policy.index}}`: 정책 문서 색인

## layout-responsive-device

`Domain/SWE/Web/FE/layout-responsive-device`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### fe.layout.presentation-split

- 수준: `code-pattern`
- 질문: mobile과 desktop 화면을 한 부품으로 만들까, 나눌까?
- 선택지:
  - shared-responsive: 한 부품이 화면 폭에 맞춰 바뀐다. 유지가 싸지만 정보 위계가 크게 다르면 조건이 복잡해진다
  - split-presentation: 기기별 표현 부품을 나누고 data·action은 공유한다. 기기별 위계를 살리지만 표현이 두 벌이 된다. 정보 위계·탐색이 같은 화면까지 나누면 연결된 기준 항목 `web-fe-layout-responsive-device.md F1`이 결함으로 본다
  - 바꾸지 않음: 지금 구조를 유지한다. 비용이 없지만 새 기기 요구를 반영하지 못한다
- 먼저 정할 결정: `fe.comp.primitive-promotion`
- 되돌림: `easy`. 표현 부품을 나누거나 합친다
- 기본값: shared-responsive. 정보 구조가 같으면 한 부품이 싸다. 탐색·정보 위계가 다르면 그 부분만 나눈다
- 확인 단서: 화면별 기기 표현 부품의 존재, `{{binding:tool.e2e}}`의 기기별 실행 설정
- 기준 항목: [web-fe-layout-responsive-device.md F1](../../review-criteria/web-fe-layout-responsive-device.md#f1-표현-책임-판정)

#### fe.layout.device-detection

- 수준: `framework-pattern`
- 질문: 기기 차이를 화면 폭(CSS)으로 처리할까, server에서 기기를 판별할까?
- 선택지:
  - viewport·CSS 우선: 화면 폭 조건으로 처리한다. 같은 URL의 첫 화면이 기기와 무관하게 같지만 기기별로 전혀 다른 기능은 어렵다
  - server 기기 판별: 요청 header로 기기를 보고 다른 화면을 보낸다. 기기별 첫 화면이 쉽지만 cache와 첫 render 일치를 따로 설계해야 한다
  - browser 판별 뒤 전환: 그린 뒤 browser에서 판별해 바꾼다. 구현은 쉽지만 깜빡임과 불일치가 생긴다. 연결된 기준 항목 `web-fe-layout-responsive-device.md F2`이 결함으로 본다
- 먼저 정할 결정: `fe.render.server-client-default`
- 되돌림: `costly`. 첫 render와 cache 경로를 고친다
- 기본값: viewport·CSS 우선. 같은 URL의 첫 화면이 기기와 상관없이 같다. 첫 화면 data·크기가 기기별로 크게 달라야 할 때만 server 판별을 쓴다. 같은 URL의 기능은 같게 두고 판별 값을 cache key에 넣는다. 기기별 기능이 필요하면 URL을 나눈다
- 확인 단서: user-agent 판별 code가 있는지, responsive style
- 기준 항목: [web-fe-layout-responsive-device.md F1](../../review-criteria/web-fe-layout-responsive-device.md#f1-표현-책임-판정), [web-fe-layout-responsive-device.md F2](../../review-criteria/web-fe-layout-responsive-device.md#f2-같은-url과-render-안전)

### 구현 지침

- [web-fe-layout-responsive-device.md F1](../../review-criteria/web-fe-layout-responsive-device.md#f1-표현-책임-판정)
- [web-fe-layout-responsive-device.md F2](../../review-criteria/web-fe-layout-responsive-device.md#f2-같은-url과-render-안전)
- [web-fe-layout-responsive-device.md F3](../../review-criteria/web-fe-layout-responsive-device.md#f3-viewportscroll-검증)

### 검증 기준

- `web-fe-layout-responsive-device.md F1`
- `web-fe-layout-responsive-device.md F2`
- `web-fe-layout-responsive-device.md F3`

### 위험

- 판정 없는 기기별 화면 복제(F1), 기기 판별로 갈린 첫 render와 숨긴 기능(F2), 좁은 화면·확대·가상 keyboard 미확인(F3)
- 비가역 선택: 없음. `fe.layout.device-detection`은 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.fe-routes}}`: route·layout 파일의 위치
- `{{binding:repo-structure.fe-features}}`: 기능별 화면 부품의 위치
- `{{binding:repo-structure.fe-shared-ui}}`: 앱 공통 UI 부품의 위치
- `{{binding:repo-structure.fe-styles}}`: 화면 폭 조건(breakpoint)과 전역 style의 위치
- `{{binding:tool.e2e}}`: 기기별 화면을 실행하는 browser test 도구

## accessibility

`Domain/SWE/Web/FE/accessibility`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### fe.a11y.baseline

- 수준: `policy`
- 질문: 접근성 최소 기준을 어디까지 둘까?
- 선택지:
  - 새·바뀐 화면 전체 WCAG 2.2 AA: 새로 만들거나 바꾸는 화면은 모두 국제 접근성 지침 AA 수준을 맞추고, 기존 화면은 바꿀 때 맞춘다. 만들 때 넣으므로 비용이 작지만 기존 화면은 차례로 좋아진다
  - 기존 화면까지 즉시 전체 AA: 지금 있는 화면도 바로 고친다. 가장 넓게 보호하지만 첫 비용이 크다
  - 핵심 흐름만 AA: 가입·핵심 작업 흐름만 맞춘다. 처음 비용은 작지만 나머지 화면을 나중에 고치는 비용이 크다. 핵심 흐름 밖의 새·바뀐 화면은 연결된 기준 항목 `web-fe-accessibility.md F1~F3`이 결함으로 본다
  - 자동 검사만: 도구가 잡는 것만 지킨다. 싸지만 keyboard·focus 문제 대부분을 놓친다. 도구가 못 잡는 keyboard·focus·상태 알림 문제는 연결된 기준 항목 `web-fe-accessibility.md F2·F3`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 기준을 낮추면 검사 범위만 줄어든다
- 기본값: 새·바뀐 화면 전체 WCAG 2.2 AA(기존 화면은 바꿀 때 맞춤). keyboard·focus·label은 만들 때 넣으면 비용이 작고 나중에 고치면 비싸다. 기존 화면을 즉시 고치는 것은 첫 비용이 커서 기본값에서 뺀다. 수준 값은 정책이 소유한다. 법·계약이 더 높은 기준(기존 화면까지 즉시 맞춤 등)을 요구하면 그 기준을 따른다
- 확인 단서: `{{binding:tool.lint}}`의 접근성 규칙, keyboard·focus test의 존재
- 기준 항목: [web-fe-accessibility.md F1](../../review-criteria/web-fe-accessibility.md#f1-의미-있는-요소와-접근-가능한-이름), [web-fe-accessibility.md F2](../../review-criteria/web-fe-accessibility.md#f2-keyboard와-focus), [web-fe-accessibility.md F3](../../review-criteria/web-fe-accessibility.md#f3-상태-알림과-비활성-이유)

#### fe.a11y.automated-check

- 수준: `operational`
- 질문: 자동 접근성 검사를 어디까지 돌릴까?
- 선택지:
  - lint 규칙만: 편집할 때 code 규칙으로만 잡는다. 빠르지만 render된 화면 문제는 못 잡는다
  - lint + 바뀐 화면 render 검사: 바뀐 화면을 그려 검사한다. 흔한 실수를 사람보다 먼저 잡지만 도구와 실행 시간이 든다
  - 위 둘 + 주기적 수동 점검: 사람이 보조기술로 확인한다. 가장 정확하지만 사람 시간이 든다
- 먼저 정할 결정: `fe.a11y.baseline`
- 되돌림: `easy`. 검사 단계를 더한다
- 기본값: lint + 바뀐 화면 render 검사. 사람이 보기 전에 기계가 흔한 실수를 잡는다. 검사 도구 추가는 dependency 승인을 거친다([swe.md S7](../../review-criteria/swe.md#s7-dependency-도입과-version-의존-동작)). render 검사 도구를 아직 들일 수 없으면 lint 규칙으로 시작하고, keyboard·focus는 이미 있는 browser test로 확인한다(`web-fe-accessibility.md F2`). 도구 승인 뒤 render 검사를 더한다
- 확인 단서: `{{binding:tool.lint}}`, `{{binding:tool.component-workshop}}`·`{{binding:tool.e2e}}`의 접근성 검사
- 기준 항목: [web-fe-accessibility.md F1](../../review-criteria/web-fe-accessibility.md#f1-의미-있는-요소와-접근-가능한-이름), [web-fe-accessibility.md F2](../../review-criteria/web-fe-accessibility.md#f2-keyboard와-focus)

### 구현 지침

- [web-fe-accessibility.md F1](../../review-criteria/web-fe-accessibility.md#f1-의미-있는-요소와-접근-가능한-이름)
- [web-fe-accessibility.md F2](../../review-criteria/web-fe-accessibility.md#f2-keyboard와-focus)
- [web-fe-accessibility.md F3](../../review-criteria/web-fe-accessibility.md#f3-상태-알림과-비활성-이유)

### 검증 기준

- `web-fe-accessibility.md F1`
- `web-fe-accessibility.md F2`
- `web-fe-accessibility.md F3`

### 위험

- 이름 없는 control과 ARIA 흉내(F1), keyboard로 쓸 수 없는 흐름과 focus 유실(F2), 알리지 않는 상태 변화와 이유 없는 비활성(F3)
- 비가역 선택: 없음

### binding 키

- `{{binding:repo-structure.fe-routes}}`: route·layout 파일(heading·landmark 구조)의 위치
- `{{binding:repo-structure.fe-features}}`: 기능별 화면 부품의 위치
- `{{binding:repo-structure.fe-shared-ui}}`: 앱 공통 UI 부품(control·overlay)의 위치
- `{{binding:repo-structure.fe-styles}}`: focus 표시와 상태 색 같은 전역 style의 위치
- `{{binding:tool.lint}}`: code 규칙 검사 도구와 설정
- `{{binding:tool.component-workshop}}`: 부품 예시를 render하는 도구
- `{{binding:tool.e2e}}`: browser test 도구
