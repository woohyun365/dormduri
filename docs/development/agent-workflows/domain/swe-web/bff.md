# Domain/SWE/Web/BFF

[Domain/SWE/Web pack](./README.md)의 BFF(backend for frontend) layer입니다. Browser와 upstream API(BFF 뒤에서 실제 data를 가진 server) 사이에서 인증 cookie,
upstream 전달, server render 중 data 읽기, 오류와 응답 정리를 맡는 중간 server를 다룹니다. 하위 layer마다 상속, 결정 목록,
구현 지침(기준 항목 인용), 검증 기준(항목 id), 위험, binding 키를 둡니다.

## gateway-forwarding

`Domain/SWE/Web/BFF/gateway-forwarding`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### bff.gw.need-bff

- 수준: `architecture-style`
- 질문: browser와 API 사이에 BFF(중간 server)를 둘까?
- 선택지:
  - 둔다: 인증 cookie 처리·upstream 주소 숨김·응답 정리를 BFF가 맡는다. browser가 token을 다루지 않지만 server 하나와 전달 규칙이 늘어난다
  - 두지 않는다: browser가 API를 직접 부른다. 구조가 단순하지만 인증 token과 응답 정리를 browser와 API가 나눠 맡아야 한다
  - 일부 route만: 필요한 route만 BFF를 거친다. 유연하지만 경로마다 인증 방식이 달라 규칙이 복잡해진다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. 인증·cookie·오류 경로 전체를 다시 설계한다
- 기본값: cookie 인증·upstream 숨김·응답 정리가 필요하면 둔다. 공개 읽기만 있는 서비스면 두지 않는다
- 확인 단서: `{{binding:repo-structure.bff-routes}}`가 있는지, upstream 주소 환경변수
- 기준 항목: [web-bff-gateway-forwarding.md B1](../../review-criteria/web-bff-gateway-forwarding.md#b1-bff를-둘-조건과-upstream-allowlist)

#### bff.gw.forward-policy

- 수준: `code-pattern`
- 질문: BFF가 upstream으로 무엇을 넘길까?
- 선택지:
  - route별 명시 allowlist: route마다 넘길 method·path·query·header·body schema를 적는다. 의도하지 않은 upstream 기능이 열리지 않지만 route마다 규칙을 써야 한다
  - path를 그대로 넘기는 공통 proxy(요청을 다른 server로 그대로 넘기는 중계기): 한 곳에서 모든 요청을 넘긴다. 빠르지만 upstream의 모든 기능과 header가 browser에 열린다. 연결된 기준 항목 `web-bff-gateway-forwarding.md B1`이 결함으로 본다
  - route별 수동 처리: route마다 직접 넘긴다. 자유롭지만 검사가 route마다 갈린다. route마다 허용 schema를 적지 않으면 연결된 기준 항목 `web-bff-gateway-forwarding.md B1`이 결함으로 본다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `costly`. route마다 전달 규칙을 다시 쓴다
- 기본값: route별 명시 allowlist. 의도하지 않은 upstream 기능이 열리지 않는다. 이 기본값은 버리지 않는다. 그대로 열어도 되는 공개 API라면 allowlist를 버리는 대신 BFF를 거칠지(`bff.gw.need-bff`)를 다시 정한다
- 확인 단서: `{{binding:repo-structure.bff-helpers}}`의 전달 helper와 그 test
- 기준 항목: [web-bff-gateway-forwarding.md B1](../../review-criteria/web-bff-gateway-forwarding.md#b1-bff를-둘-조건과-upstream-allowlist)

#### bff.gw.mutation-entry

- 수준: `framework-pattern`
- 질문: 상태를 바꾸는 요청을 어떤 진입점으로 받을까?
- 선택지:
  - framework의 server 함수 호출: 화면 code에서 server 함수를 바로 부른다. 작성이 짧지만 인증·위조 방어·오류 형식을 framework 동작에 맞춰 따로 확인해야 한다
  - route handler와 browser 요청: BFF route가 요청을 받는다. 인증·위조 방어·오류 형식을 한 곳에서 명시적으로 검사하지만 route와 client 호출 code가 늘어난다
  - browser가 upstream 직접 호출: BFF를 거치지 않는다. 단순하지만 cookie 인증과 응답 정리를 BFF가 맡을 수 없다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `costly`. 진입점과 위조 방어·오류 처리를 옮긴다
- 기본값: route handler와 browser 요청. 인증·위조 방어·오류 형식을 한 곳에서 명시적으로 검사한다. framework가 같은 보장을 주고 팀이 그 방식에 익숙하면 server 함수 호출을 쓴다
- 확인 단서: `{{binding:stack.fe-framework}}`, `{{binding:repo-structure.bff-routes}}`의 상태 변경 method
- 기준 항목: [web-bff-gateway-forwarding.md B2](../../review-criteria/web-bff-gateway-forwarding.md#b2-mutation-진입점-선택), [web-security-privacy-trust-authz-model.md P1](../../review-criteria/web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지)

#### bff.gw.upstream-stub

- 수준: `code-pattern`
- 질문: BFF route test에서 upstream을 어디까지 대역(진짜 대신 쓰는 가짜 응답)으로 바꿀까?
- 선택지:
  - network 호출 경계만 대역: route handler는 실제로 실행하고 upstream으로 나가는 호출만 대역으로 바꾼다. 넘긴 요청 모양과 upstream 응답별 번역을 함께 보지만, 대역 응답이 실제 upstream 계약과 어긋나면 놓친다(대역 응답을 공유 schema로 만들어 줄인다)
  - 내부 전달 helper mock: 전달 helper나 client module을 가짜로 바꾼다. 쓰기 쉽지만 route가 실제로 넘기는 header·cookie와 오류 번역을 보지 못한다. 연결된 기준 항목 `web-bff-gateway-forwarding.md B1`이 결함으로 본다
  - 실제 upstream: test 환경에서 upstream server를 띄운다. 계약 어긋남을 직접 잡지만 느리고 환경이 필요해 route test마다 쓰기 어렵다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `easy`. test의 대역 지점만 바꾼다
- 기본값: network 호출 경계만 대역. route가 실제로 넘기는 요청과 오류 번역을 빠르게 본다. 대역 응답은 공유 schema로 만들고, 실제 upstream과의 어긋남은 API server까지 띄우는 E2E(`fe.render.e2e-scope`)나 contract test가 본다
- 확인 단서: `{{binding:repo-structure.bff-routes}}`의 route test가 대역으로 바꾸는 지점
- 기준 항목: [web-bff-gateway-forwarding.md B1](../../review-criteria/web-bff-gateway-forwarding.md#b1-bff를-둘-조건과-upstream-allowlist), [swe.md S6](../../review-criteria/swe.md#s6-보호-test)

### 구현 지침

- [web-bff-gateway-forwarding.md B1](../../review-criteria/web-bff-gateway-forwarding.md#b1-bff를-둘-조건과-upstream-allowlist)
- [web-bff-gateway-forwarding.md B2](../../review-criteria/web-bff-gateway-forwarding.md#b2-mutation-진입점-선택)

### 검증 기준

- `web-bff-gateway-forwarding.md B1`
- `web-bff-gateway-forwarding.md B2`

### 위험

- 임의 path·header를 upstream으로 넘기는 proxy와 전달 helper를 보안 검사로 세는 것(B1), 같은 action의 진입점 복제(B2)
- 비가역 선택: `bff.gw.need-bff`(`one-way`), `bff.gw.mutation-entry`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:repo-structure.bff-routes}}`: BFF route의 위치
- `{{binding:repo-structure.bff-helpers}}`: BFF 공통 helper의 위치
- `{{binding:stack.fe-framework}}`: 쓰는 web framework와 그 version

## session-cookie-auth

`Domain/SWE/Web/BFF/session-cookie-auth`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-trust-authz-model.md P1](../../review-criteria/web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지)

### 결정 목록

#### bff.session.cookie-attributes

- 수준: `policy`
- 질문: login cookie를 어떤 속성으로 줄까?
- 선택지:
  - `__Host-` 이름과 Secure·HttpOnly·SameSite=Lax: script가 token을 읽지 못하고 HTTPS·현재 host에만 붙으며 일반 link 이동은 된다. 다른 site에서 오는 일부 요청에는 cookie가 붙지 않는다
  - SameSite=Strict: 다른 site에서 들어오는 모든 요청에 cookie를 붙이지 않는다. 더 안전하지만 외부 link로 들어오면 login이 풀린 것처럼 보인다
  - token을 script가 보관: browser 저장소에 token을 둔다. 구현이 쉽지만 script 주입 한 번에 token이 새어 나간다. 연결된 기준 항목 `web-bff-session-cookie-auth.md B1`이 결함으로 본다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `costly`. login cookie를 다시 발급하고 cross-site 동작이 바뀐다
- 기본값: `__Host-` 이름과 Secure·HttpOnly·SameSite=Lax. script가 token을 읽지 못해 script 주입 피해가 줄고 일반 link 이동은 된다. 값은 정책 문서가 소유한다. 다른 site가 POST로 되돌아오는 흐름(외부 결제 복귀 등)이 있으면 그 cookie의 SameSite 값만 따로 검토하고(속성은 빼지 않는다) 위조 방어를 함께 둔다. `__Host-` 이름과 Secure·HttpOnly는 버리지 않는다
- 확인 단서: `{{binding:policy.account-authentication}}`, cookie를 발급하는 helper
- 기준 항목: [web-bff-session-cookie-auth.md B1](../../review-criteria/web-bff-session-cookie-auth.md#b1-cookie-속성과-token-보관)

#### bff.session.csrf-defense

- 수준: `code-pattern`
- 질문: cookie로 인증하는 변경 요청을 다른 site의 위조 요청에서 어떻게 막을까?
- 선택지:
  - Origin·Fetch Metadata header 명시 검사: server가 요청 출처를 확인해 다른 출처를 거부한다. 별도 token이 없지만 header를 보내지 않는 오래된 client를 따로 다뤄야 한다
  - 위조 방지 token: 화면에 token을 심고 요청마다 확인한다. 오래 쓰인 방식이고 출처 header가 없어도 되지만 token 발급·전달 code가 늘어난다
  - SameSite 속성만: cookie 속성에 맡긴다. code가 없지만 browser·요청 종류에 따라 막히지 않는 경우가 있다. 연결된 기준 항목 `web-security-privacy-trust-authz-model.md P1`이 결함으로 본다
- 먼저 정할 결정: `bff.session.cookie-attributes`, `bff.gw.mutation-entry`
- 되돌림: `costly`. 모든 상태 변경 route를 고친다
- 기본값: Origin·Fetch Metadata header 명시 검사와 SameSite 보조. 별도 token 없이 server가 출처를 확인한다. 다른 출처의 form 제출을 받아야 하면 위조 방지 token을 쓴다
- 확인 단서: `{{binding:repo-structure.bff-helpers}}`의 출처 검사와 cross-origin 거부 test
- 기준 항목: [web-security-privacy-trust-authz-model.md P1](../../review-criteria/web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지)

#### bff.session.refresh-location

- 수준: `code-pattern`
- 질문: login 유지(session 갱신)를 어디서 할까?
- 선택지:
  - 요청 진입 middleware(요청이 route에 닿기 전에 모두 지나는 공통 code)·route: 요청이 들어올 때 갱신한다. 화면과 cookie가 어긋나지 않지만 진입 지점에 갱신 실패 처리를 둬야 한다
  - 화면 render 중: 그리면서 갱신한다. code가 가깝지만 render 결과와 cookie가 어긋나고 framework가 막기도 한다. 연결된 기준 항목 `web-bff-session-cookie-auth.md B2`이 결함으로 본다
  - browser: browser가 주기적으로 갱신 요청을 보낸다. server가 단순하지만 여러 tab이 동시에 갱신해 token이 덮인다. 연결된 기준 항목 `web-bff-session-cookie-auth.md B2`이 결함으로 본다
- 먼저 정할 결정: `bff.session.cookie-attributes`
- 되돌림: `costly`. 갱신 흐름과 실패 처리를 옮긴다
- 기본값: 요청 진입 middleware·route. 화면을 그리는 중에 cookie를 쓰지 않아 첫 화면과 cookie가 어긋나지 않는다. 이 기본값은 버리지 않는다. BFF가 있으면 요청 진입 지점이 있으므로 갱신은 그곳 한 곳에 둔다(`web-bff-session-cookie-auth.md B2`)
- 확인 단서: `{{binding:repo-structure.server-session}}`, 요청 진입 middleware 파일
- 기준 항목: [web-bff-session-cookie-auth.md B2](../../review-criteria/web-bff-session-cookie-auth.md#b2-session-갱신-위치)

### 구현 지침

- [web-bff-session-cookie-auth.md B1](../../review-criteria/web-bff-session-cookie-auth.md#b1-cookie-속성과-token-보관)
- [web-bff-session-cookie-auth.md B2](../../review-criteria/web-bff-session-cookie-auth.md#b2-session-갱신-위치)

### 검증 기준

- `web-bff-session-cookie-auth.md B1`
- `web-bff-session-cookie-auth.md B2`

### 위험

- 속성이 빠진 인증 cookie와 script가 읽는 token(B1), render 중 cookie 갱신과 동시 갱신(B2), 출처 검사 없는 상태 변경(상속한 trust-authz-model P1)
- 비가역 선택: `bff.session.cookie-attributes`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:policy.account-authentication}}`: 인증·cookie 정책 원본
- `{{binding:repo-structure.bff-helpers}}`: BFF 공통 helper의 위치
- `{{binding:repo-structure.server-session}}`: server 쪽 session 읽기와 요청 진입 middleware의 위치

## server-read-error-privacy-shaping

`Domain/SWE/Web/BFF/server-read-error-privacy-shaping`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-data-privacy-secret.md P1](../../review-criteria/web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)

### 결정 목록

#### bff.read.error-shaping

- 수준: `code-pattern`
- 질문: upstream 오류와 응답을 browser에 어떻게 넘길까?
- 선택지:
  - 안전한 공통 오류 형식으로 번역: 공통 helper가 종류별로 바꾼다. 내부 정보가 새지 않고 화면이 한 방식으로 처리하지만 형식을 관리해야 한다
  - 그대로 전달: upstream 오류를 그대로 넘긴다. 빠르지만 내부 오류·개인정보가 browser에 보인다. 연결된 기준 항목 `web-bff-server-read-error-privacy-shaping.md B2`이 결함으로 본다
  - route별: route마다 정한다. 자유롭지만 화면이 route마다 다르게 처리해야 한다. 연결된 기준 항목 `web-bff-server-read-error-privacy-shaping.md B2`이 결함으로 본다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `easy`. helper를 바꾼다
- 기본값: 안전한 공통 오류 형식으로 번역. 내부 오류·개인정보가 새지 않고 화면이 한 방식으로 처리한다. 이 기본값은 버리지 않는다. 개발 중에 자세한 오류가 필요하면 server log에서 보고 browser 응답은 같은 형식을 쓴다
- 확인 단서: `{{binding:repo-structure.bff-helpers}}`의 오류 helper와 그 test
- 기준 항목: [web-bff-server-read-error-privacy-shaping.md B2](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b2-오류-번역)

#### bff.read.server-read-path

- 수준: `code-pattern`
- 질문: server가 화면을 그릴 때 data를 어떻게 읽을까?
- 선택지:
  - upstream 직접 호출: server가 upstream을 바로 읽는다. 왕복과 cookie 재전달이 없지만 응답 정리 규칙을 BFF와 공유해야 한다
  - 자기 BFF route 다시 호출(loopback): server가 자기 route를 HTTP로 부른다. 규칙을 한 곳에 두기 쉽지만 왕복이 늘고 cookie를 다시 실어야 한다. 연결된 기준 항목 `web-bff-server-read-error-privacy-shaping.md B1`이 결함으로 본다
  - browser에서 읽기: 화면을 그린 뒤 browser가 읽는다. server가 단순하지만 첫 화면에 data가 늦게 나온다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `easy`. reader를 바꾼다
- 기본값: upstream 직접 호출. 불필요한 왕복과 cookie 재전달이 없다. 같은 응답 정리 규칙은 공유 helper로 재사용한다. 첫 화면에 없어도 되는 보조 data는 browser에서 읽어도 된다. 자기 route를 다시 부르는 loopback은 `web-bff-server-read-error-privacy-shaping.md B1`이 결함으로 본다
- 확인 단서: `{{binding:repo-structure.bff-helpers}}`의 server reader, loopback 호출이 있는지
- 기준 항목: [web-bff-server-read-error-privacy-shaping.md B1](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b1-server-read-경로)

#### bff.read.response-projection

- 수준: `code-pattern`
- 질문: browser로 보낼 응답 필드를 어떻게 정할까?
- 선택지:
  - route별 필요 필드 projection: route마다 화면에 필요한 필드만 고른다. 개인정보·내부 값이 나가지 않지만 projection과 test를 써야 한다
  - upstream 응답 그대로: 받은 응답을 넘긴다. 빠르지만 필요 없는 필드가 browser에 간다. 연결된 기준 항목 `web-bff-server-read-error-privacy-shaping.md B3`이 결함으로 본다
  - 공통 filter: 위험한 필드만 공통으로 지운다. 한 곳에서 관리하지만 새 필드가 생기면 그대로 새어 나간다. 연결된 기준 항목 `web-bff-server-read-error-privacy-shaping.md B3`이 결함으로 본다
- 먼저 정할 결정: `bff.gw.need-bff`
- 되돌림: `costly`. 화면이 받는 contract가 바뀐다
- 기본값: route별 필요 필드 projection. 화면에 필요 없는 개인정보·내부 값이 나가지 않는다. 숨긴 값은 숨긴 채로 둔다. 이 기본값은 버리지 않는다. upstream이 화면용 contract를 주더라도 route마다 projection과 '필요 없는 field 없음' test를 둔다(`web-bff-server-read-error-privacy-shaping.md B3`)
- 확인 단서: BFF mapper와 그 test, `{{binding:repo-structure.shared-contract}}`의 공유 contract
- 기준 항목: [web-bff-server-read-error-privacy-shaping.md B3](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b3-응답-최소화와-upstream-검증), [web-security-privacy-data-privacy-secret.md P1](../../review-criteria/web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)

### 구현 지침

- [web-bff-server-read-error-privacy-shaping.md B1](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b1-server-read-경로)
- [web-bff-server-read-error-privacy-shaping.md B2](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b2-오류-번역)
- [web-bff-server-read-error-privacy-shaping.md B3](../../review-criteria/web-bff-server-read-error-privacy-shaping.md#b3-응답-최소화와-upstream-검증)

### 검증 기준

- `web-bff-server-read-error-privacy-shaping.md B1`
- `web-bff-server-read-error-privacy-shaping.md B2`
- `web-bff-server-read-error-privacy-shaping.md B3`

### 위험

- loopback 호출과 사용자 data의 공유 cache(B1), 내부 오류 원문 노출과 오류 종류 뭉침(B2), upstream 응답 통째 전달(B3), 숨긴 값의 재조회·cache·log(상속한 data-privacy-secret P1)
- 비가역 선택: 없음. `bff.read.response-projection`은 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.bff-helpers}}`: BFF 공통 helper의 위치
- `{{binding:repo-structure.shared-contract}}`: 공유 contract의 위치
