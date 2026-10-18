# Domain/SWE/Web/BE

[Domain/SWE/Web pack](./README.md)의 BE(backend) layer입니다. 업무 규칙의 owner와 상태 전이, API 계약과 오류, 인증·인가, server
code의 층과 module 구조, transaction·동시성·멱등성, background 작업·외부 호출·성능을 다룹니다. 하위 layer마다 상속, 결정 목록,
구현 지침(기준 항목 인용), 검증 기준(항목 id), 위험, binding 키를 둡니다.

## domain-model-invariant

`Domain/SWE/Web/BE/domain-model-invariant`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### be.domain.owner-unit

- 수준: `architecture-style`
- 질문: 업무 규칙의 owner를 무엇 단위로 나눌까?
- 선택지:
  - 업무 capability(aggregate) 단위: 같은 상태를 함께 바꾸는 규칙의 묶음마다 owner를 둔다. 규칙이 한 곳에 모여 복제가 없지만 처음에 업무 경계를 정해야 한다
  - 화면·진입점 단위: 화면이나 진입점(controller)마다 owner를 둔다. 처음에는 찾기 쉽지만 같은 규칙이 화면마다 복제되고 한 상태를 여러 곳이 바꾼다. 연결된 기준 항목 `web-be-domain-model-invariant.md E1`이 결함으로 본다
  - table 단위: 저장 table마다 owner를 둔다. data 위치와 맞아 찾기 쉽지만, 한 업무가 여러 table에 걸치면 규칙이 owner 사이에 갈린다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. module과 책임을 다시 배치한다
- 기본값: 업무 capability 단위. 같은 상태를 바꾸는 규칙이 한 owner에 모여 복제가 없다. 기능이 아주 적으면 module 하나로 시작하고 capability가 갈릴 때 나눈다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 module 구성과 owner README
- 기준 항목: [web-be-domain-model-invariant.md E1](../../review-criteria/web-be-domain-model-invariant.md#e1-capabilityaggregate-owner)

#### be.domain.state-enforcement

- 수준: `code-pattern`
- 질문: 상태 전이 규칙을 어디서 강제할까?
- 선택지:
  - domain policy 함수 + DB 조건부 갱신: 업무 규칙 함수가 허용 전이를 판정하고, DB 갱신은 지금 상태가 맞을 때만 바꾸는 조건을 단다. 경쟁하는 요청에도 깨지지 않지만 두 곳의 판정을 함께 test해야 한다
  - 진입점 검사만: 진입점이 지금 상태를 읽어 확인한다. 가장 단순하지만 확인과 쓰기 사이에 다른 요청이 끼어들 수 있다. 동시 요청이 같은 상태를 바꿀 수 있으면 연결된 기준 항목 `web-be-transaction-concurrency-idempotency.md E1`이 결함으로 본다
  - DB 제약만: check 제약 같은 DB 규칙으로만 막는다. 우회할 수 없지만 제약으로 표현할 수 없는 전이 규칙은 담지 못하고 오류를 사용자 의미로 바꾸기 어렵다
- 먼저 정할 결정: `be.domain.owner-unit`
- 되돌림: `easy`. 검사 위치를 더한다
- 기본값: domain policy 함수 + DB 조건부 갱신. 금지 전이를 code와 DB가 함께 막아 경쟁 상황에서도 깨지지 않는다. 상태가 둘뿐인 단순 flag면 DB 조건부 갱신만으로 충분하다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 policy 함수, `{{binding:repo-structure.be-tests}}`의 금지 전이 test
- 기준 항목: [web-be-domain-model-invariant.md E2](../../review-criteria/web-be-domain-model-invariant.md#e2-상태-전이선행-조건종료-상태의-server-강제), [web-be-transaction-concurrency-idempotency.md E1](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e1-read-check-write-보호)

### 구현 지침

- [web-be-domain-model-invariant.md E1](../../review-criteria/web-be-domain-model-invariant.md#e1-capabilityaggregate-owner)
- [web-be-domain-model-invariant.md E2](../../review-criteria/web-be-domain-model-invariant.md#e2-상태-전이선행-조건종료-상태의-server-강제)

### 검증 기준

- `web-be-domain-model-invariant.md E1`
- `web-be-domain-model-invariant.md E2`

### 위험

- controller·화면 이름으로 정한 owner와 다른 domain 규칙의 복제(E1), server 검사 없는 금지 전이와 종료 상태 뒤의 변경, server 선행 조건과 어긋난 action capability(E2)
- 비가역 선택: `be.domain.owner-unit`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:repo-structure.be-src}}`: server code의 위치
- `{{binding:repo-structure.be-tests}}`: server test의 위치
- `{{binding:repo-structure.be-config}}`: server package 최상위 설정 파일의 위치

## api-design-contract

`Domain/SWE/Web/BE/api-design-contract`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-data-privacy-secret.md P1](../../review-criteria/web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)
- [web-security-privacy-data-privacy-secret.md P2](../../review-criteria/web-security-privacy-data-privacy-secret.md#p2-데이터-분류와-수집전달-최소화)

### 결정 목록

#### be.api.style

- 수준: `architecture-style`
- 질문: API를 어떤 방식으로 노출할까?
- 선택지:
  - resource 중심 HTTP: 주소(resource)와 HTTP method로 노출한다. 도구·cache·관측이 가장 잘 맞고 배우기 쉽지만, 화면에 필요한 data를 여러 요청으로 모아야 할 수 있다
  - 질의 언어(GraphQL): 소비자가 필요한 field를 질의로 고른다. 화면마다 필요한 모양을 한 번에 받지만, 질의마다 비용·권한을 따로 제한해야 하고 HTTP cache를 쓰기 어렵다
  - 원격 함수 호출(RPC): 함수 이름과 인자로 호출한다. 내부 호출처럼 단순하지만 resource 이름·cache 관례가 없어 공개 API의 일관성을 따로 지켜야 한다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. 모든 소비자와 오류·인증 경로를 다시 쓴다
- 기본값: resource 중심 HTTP. 도구·cache·관측이 가장 잘 맞고 배우기 쉽다. 화면마다 필요한 data 모양이 크게 다르고 소비자가 많으면 질의 언어를 검토한다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 진입점 정의, `{{binding:repo-structure.shared-contract}}`
- 기준 항목: [web-be-api-design-contract.md E1](../../review-criteria/web-be-api-design-contract.md#e1-경계-schema-검증과-내부-type-비노출), [web-be-api-design-contract.md E3](../../review-criteria/web-be-api-design-contract.md#e3-목록-상한paginationresource-명명)

#### be.api.error-shape

- 수준: `code-pattern`
- 질문: 오류 응답을 어떤 형식으로 줄까?
- 선택지:
  - 표준 문제 상세 형식: 공개 표준의 오류 형식(type·title·status·detail)을 쓴다. 도구와 문서가 이미 있지만 저장소 고유 field는 확장으로 더해야 한다
  - 저장소 공통 envelope: 저장소가 정한 오류 형식 하나를 모든 진입점에서 쓴다. 필요한 field를 자유롭게 두지만 형식 문서를 직접 관리해야 한다
  - 진입점별 형식: 진입점마다 편한 형식으로 답한다. 빨리 만들 수 있지만 화면이 오류를 진입점마다 다르게 처리해야 한다. 연결된 기준 항목 `web-be-api-design-contract.md E2`이 결함으로 본다
- 먼저 정할 결정: `be.api.style`
- 되돌림: `costly`. 모든 소비자의 오류 처리를 고친다
- 기본값: 공통 형식 하나(표준 문제 상세 형식이나 저장소 envelope). 화면이 오류를 한 방식으로 처리하고 의미가 구분된다. 이미 소비자가 쓰는 envelope가 있으면 그것을 유지한다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 오류 변환 code, `{{binding:repo-structure.shared-contract}}`의 오류 schema
- 기준 항목: [web-be-api-design-contract.md E2](../../review-criteria/web-be-api-design-contract.md#e2-오류-의미-구분)

#### be.api.compatibility

- 수준: `policy`
- 질문: 공개 API를 바꿀 때 호환을 어떻게 지킬까?
- 선택지:
  - 추가만 하고 제거는 예고 뒤: 새 field·진입점은 더하기만 하고, 지우거나 의미를 바꿀 때는 deprecated 표시와 제거 조건을 둔 뒤 옛 소비자가 사라지면 지운다. 배포 순서와 상관없이 동작하지만 옛 field가 한동안 남는다
  - version 경로 분리: 깨지는 변경을 새 version으로 따로 낸다. 옛 소비자를 그대로 두지만 두 version을 함께 유지하고 나중에 정리해야 한다
  - 소비자와 같은 변경에서 한 번에 바꿈: producer와 소비자를 한 변경에서 함께 고친다. 가장 단순하지만 따로 배포되는 소비자는 배포 사이에 깨진다. 옛 소비자가 배포 중에 남으면 연결된 기준 항목 `web-be-api-design-contract.md E4`이 결함으로 본다
- 먼저 정할 결정: `be.api.style`
- 되돌림: `costly`. 소비자 전환 기간과 정리 작업이 따른다
- 기본값: 추가 우선, 제거는 예고와 제거 조건 뒤. 따로 배포되는 소비자가 배포 순서와 상관없이 동작한다. 모든 소비자가 같은 배포 단위에 있으면 한 번에 바꿔도 된다
- 확인 단서: `{{binding:repo-structure.shared-contract}}`의 변경 이력과 deprecated 표시
- 기준 항목: [web-be-api-design-contract.md E4](../../review-criteria/web-be-api-design-contract.md#e4-공유-contract-owner호환성deprecation)

### 구현 지침

- [web-be-api-design-contract.md E1](../../review-criteria/web-be-api-design-contract.md#e1-경계-schema-검증과-내부-type-비노출)
- [web-be-api-design-contract.md E2](../../review-criteria/web-be-api-design-contract.md#e2-오류-의미-구분)
- [web-be-api-design-contract.md E3](../../review-criteria/web-be-api-design-contract.md#e3-목록-상한paginationresource-명명)
- [web-be-api-design-contract.md E4](../../review-criteria/web-be-api-design-contract.md#e4-공유-contract-owner호환성deprecation)

### 검증 기준

- `web-be-api-design-contract.md E1`
- `web-be-api-design-contract.md E2`
- `web-be-api-design-contract.md E3`
- `web-be-api-design-contract.md E4`

### 위험

- 검증 없이 쓰는 요청 body와 내부 type을 그대로 노출하는 응답(E1), 하나로 뭉친 오류와 빈 결과로 숨긴 실패(E2), 상한 없는 목록과 내용이 바뀌는 목록의 offset(E3), 옛 소비자의 호환 구간 없이 지운 field(E4), 숨긴 값과 목적 밖 field를 담은 응답(상속한 data-privacy-secret P1·P2)
- 비가역 선택: `be.api.style`(`one-way`). `be.api.error-shape`와 `be.api.compatibility`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.be-src}}`: server code의 위치
- `{{binding:repo-structure.be-tests}}`: server test의 위치
- `{{binding:repo-structure.be-config}}`: server package 최상위 설정 파일의 위치
- `{{binding:repo-structure.shared-contract}}`: 공유 contract의 위치

## authn-authz

`Domain/SWE/Web/BE/authn-authz`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-trust-authz-model.md P2](../../review-criteria/web-security-privacy-trust-authz-model.md#p2-서버-쪽-인가와-객체-단위-권한)
- [web-security-privacy-trust-authz-model.md P3](../../review-criteria/web-security-privacy-trust-authz-model.md#p3-열거추측재전송빈도-남용-방어)

### 결정 목록

#### be.auth.session-model

- 수준: `architecture-style`
- 질문: 로그인 상태를 어떻게 유지할까?
- 선택지:
  - server 저장 session: server가 session을 저장하고 browser에는 식별자만 준다. 로그아웃·강제 종료가 바로 반영되고 유출 피해가 작지만 요청마다 session 저장소를 읽는다
  - 서명된 token: server가 서명한 token에 사용자 정보를 담아 준다. 저장소 조회 없이 여러 서비스가 검증할 수 있지만 만료 전에 무효화하기 어렵다
  - 외부 인증 provider session: 외부 인증 서비스가 로그인 상태를 가진다. 인증 기능을 직접 만들지 않아도 되지만 provider에 의존하고 provider 장애가 로그인을 막는다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. 모든 사용자가 다시 로그인하고 인증 경로를 다시 쓴다
- 기본값: server 저장 session. 즉시 무효화(로그아웃·강제 종료)가 쉽고 token 유출 피해가 작다. 여러 독립 서비스가 같은 인증을 검증해야 하면 서명된 token을 검토한다
- 확인 단서: `{{binding:policy.account-authentication}}`, `{{binding:repo-structure.be-src}}`의 인증 module
- 기준 항목: [web-be-authn-authz.md E1](../../review-criteria/web-be-authn-authz.md#e1-기본-인증과-공통-판정-위치)

#### be.auth.default-protection

- 수준: `code-pattern`
- 질문: 새 진입점의 인증을 기본으로 켤까?
- 선택지:
  - 기본 보호 + 공개 진입점만 명시: 모든 진입점이 기본으로 인증을 요구하고 공개 진입점에만 공개 표시를 단다. 인증을 빠뜨린 진입점이 생기지 않지만 공개 진입점마다 표시를 달아야 한다
  - 진입점마다 명시적으로 켬: 인증이 필요한 진입점마다 직접 켠다. 공개 진입점이 많으면 표시가 적지만 켜는 것을 잊은 진입점이 공개된다. 연결된 기준 항목 `web-be-authn-authz.md E1`이 결함으로 본다
- 먼저 정할 결정: `be.auth.session-model`
- 되돌림: `easy`. 전역 guard(모든 진입점이 지나는 공통 판정)와 공개 표시를 더한다
- 기본값: 기본 보호. 인증을 빠뜨린 새 진입점이 공개되지 않는다. 공개 진입점이 대부분인 서비스여도 기본 보호를 유지하고 공개 표시를 늘린다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 전역 guard와 공개 표시, `{{binding:repo-structure.be-tests}}`의 진입점 인증 matrix test
- 기준 항목: [web-be-authn-authz.md E1](../../review-criteria/web-be-authn-authz.md#e1-기본-인증과-공통-판정-위치)

#### be.auth.capability-exposure

- 수준: `code-pattern`
- 질문: 사용자가 할 수 있는 행동을 화면에 어떻게 알려 줄까?
- 선택지:
  - server가 capability 목록을 응답에 담음: server가 행동마다 할 수 있는지 계산해 응답에 담는다. 화면 표시와 server 판정이 같은 원천을 쓰지만 응답 field가 늘어난다
  - client가 역할로 계산: 화면이 사용자 역할로 할 수 있는 행동을 계산한다. server 응답이 단순하지만 server 판정과 어긋날 수 있다. server 판정이 상태·소유 같은 역할 밖 조건을 보면 연결된 기준 항목 `web-be-authn-authz.md E2`이 결함으로 본다
  - 알리지 않고 실패로 알게 함: 화면은 행동을 모두 보여 주고 server의 거부 응답으로 알린다. 구현이 가장 적지만 사용자는 해 보기 전에 할 수 없다는 것을 모른다
- 먼저 정할 결정: `sec.trust.authz-model`
- 되돌림: `easy`. 응답 field를 더한다
- 기본값: server가 capability 목록을 담음. 화면 표시와 server 판정이 같은 원천을 쓴다. 행동이 한두 개뿐이면 실패 응답으로 알려도 된다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 presenter와 capability 계산
- 기준 항목: [web-be-authn-authz.md E2](../../review-criteria/web-be-authn-authz.md#e2-capabilityrole-판정과-진입점별-인가-표), [web-be-domain-model-invariant.md E2](../../review-criteria/web-be-domain-model-invariant.md#e2-상태-전이선행-조건종료-상태의-server-강제)

### 구현 지침

- [web-be-authn-authz.md E1](../../review-criteria/web-be-authn-authz.md#e1-기본-인증과-공통-판정-위치)
- [web-be-authn-authz.md E2](../../review-criteria/web-be-authn-authz.md#e2-capabilityrole-판정과-진입점별-인가-표)

### 검증 기준

- `web-be-authn-authz.md E1`
- `web-be-authn-authz.md E2`

### 위험

- 기본으로 공개되는 새 진입점과 흩어진 인증 판정(E1), 역할 이름만으로 한 판정과 code와 다른 인가 표, 감사 기록 없는 운영자 권한(E2), 대상 소유 확인이 빠진 진입점과 빈도 제한 없는 추측 요청(상속한 trust-authz-model P2·P3)
- 비가역 선택: `be.auth.session-model`(`one-way`)

### binding 키

- `{{binding:repo-structure.be-src}}`: server code의 위치
- `{{binding:repo-structure.be-tests}}`: server test의 위치
- `{{binding:repo-structure.be-config}}`: server package 최상위 설정 파일의 위치
- `{{binding:policy.account-authentication}}`: 인증·권한 정책 원본

## application-architecture

`Domain/SWE/Web/BE/application-architecture`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### be.arch.layering

- 수준: `architecture-style`
- 질문: server code의 층을 어떻게 나눌까?
- 선택지:
  - 진입점 → command·query → domain policy → repository·provider: 요청 처리, 업무 흐름, 업무 규칙, 저장·외부 호출을 나눈다. transport 세부가 업무 code에 새지 않고 규칙을 따로 test할 수 있지만 파일과 층이 늘어난다
  - 진입점 → service 두 층: 진입점과 service 하나로 나눈다. 작은 기능에는 단순하지만 기능이 커지면 service 하나가 규칙·저장·외부 호출을 함께 가져 커진다
  - 기능별 자유 구조: 기능마다 편한 구조를 쓴다. 제약이 없지만 기능마다 구조가 달라 다른 기능을 읽기 어렵다
- 먼저 정할 결정: `be.domain.owner-unit`
- 되돌림: `costly`. 파일을 옮기고 의존 방향을 다시 정리한다
- 기본값: 네 층을 기본으로 하되 필요 없는 층은 건너뜀. transport 세부가 업무 code에 새지 않고, 작은 기능은 형식적인 층을 만들지 않는다. 기능이 몇 개뿐이면 두 층으로 시작한다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 owner README와 import 경계 test
- 기준 항목: [web-be-application-architecture.md E1](../../review-criteria/web-be-application-architecture.md#e1-layer-흐름과-transport-누수), [web-be-application-architecture.md E2](../../review-criteria/web-be-application-architecture.md#e2-flat-우선과-불필요-추상화-금지)

#### be.arch.slice-shape

- 수준: `code-pattern`
- 질문: owner 안 파일을 어떻게 둘까?
- 선택지:
  - flat(한 디렉터리): owner의 파일을 한 디렉터리에 둔다. 작은 owner에서 찾기 쉽지만 파일이 많아지면 목록이 길어진다
  - 독립 lifecycle이 있을 때만 하위 slice: 따로 바뀌는 이유가 있는 부분만 하위 디렉터리로 나눈다. 구조가 필요할 때만 늘지만 나눌 때를 판단해야 한다
  - 처음부터 층별 하위 디렉터리: 처음부터 층마다 하위 디렉터리를 만든다. 모양이 일정하지만 작은 owner에도 빈 구조가 생긴다. 작은 owner에도 만들면 연결된 기준 항목 `web-be-application-architecture.md E2`이 결함으로 본다
- 먼저 정할 결정: `be.arch.layering`
- 되돌림: `easy`. 파일을 옮긴다
- 기본값: flat 우선, 독립 lifecycle이 생기면 하위 slice. 작은 owner를 찾기 쉽고 구조가 필요할 때만 늘린다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 owner 디렉터리 깊이
- 기준 항목: [web-be-application-architecture.md E2](../../review-criteria/web-be-application-architecture.md#e2-flat-우선과-불필요-추상화-금지)

#### be.arch.process-state

- 수준: `architecture-style`
- 질문: instance 사이에 공유해야 하는 상태(잠금·nonce·빈도 counter)를 어디에 둘까?
- 선택지:
  - DB(unique·조건부 갱신): 이미 있는 DB의 unique 제약과 조건부 갱신으로 판정한다. 새 dependency 없이 instance가 늘어도 정확하지만 요청마다 DB 부하가 늘어난다
  - 별도 공유 저장소(cache): 빠른 공유 저장소에 둔다. DB 부하를 덜지만 새 dependency와 운영 대상이 생긴다. 실제 multi-instance 요구 없이 범용 port로 들이면 연결된 기준 항목 `web-be-application-architecture.md E4`이 결함으로 본다
  - process 메모리: 각 instance의 메모리에 둔다. 가장 빠르고 단순하지만 instance마다 따로 가져 instance가 늘면 틀린다. instance가 둘 이상이거나 늘 수 있으면 연결된 기준 항목 `web-be-application-architecture.md E4`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 상태 저장 위치와 정확성 test를 다시 쓴다
- 기본값: DB unique·조건부 갱신. 새 dependency 없이 instance가 늘어도 정확하다. DB 부하가 측정으로 문제가 되면 공유 저장소를 검토한다(새 dependency는 [swe.md S7](../../review-criteria/swe.md#s7-dependency-도입과-version-의존-동작))
- 확인 단서: `{{binding:repo-structure.be-src}}`의 메모리 자료 구조·counter 사용, `{{binding:repo-structure.be-config}}`
- 기준 항목: [web-be-application-architecture.md E4](../../review-criteria/web-be-application-architecture.md#e4-process-상태와-설정-주입)

### 구현 지침

- [web-be-application-architecture.md E1](../../review-criteria/web-be-application-architecture.md#e1-layer-흐름과-transport-누수)
- [web-be-application-architecture.md E2](../../review-criteria/web-be-application-architecture.md#e2-flat-우선과-불필요-추상화-금지)
- [web-be-application-architecture.md E3](../../review-criteria/web-be-application-architecture.md#e3-domain-간-공개-contract-호출과-table-공유-금지)
- [web-be-application-architecture.md E4](../../review-criteria/web-be-application-architecture.md#e4-process-상태와-설정-주입)

### 검증 기준

- `web-be-application-architecture.md E1`
- `web-be-application-architecture.md E2`
- `web-be-application-architecture.md E3`
- `web-be-application-architecture.md E4`

### 위험

- 업무 code로 새는 transport 세부와 하는 일 없는 layer(E1), 작은 owner의 중첩 slice와 호출부 없는 code(E2), 다른 domain table의 직접 접근과 운영 도구의 제품 table 수정(E3), instance가 늘면 틀리는 메모리 상태와 code에 고정한 설정·자격 증명(E4)
- 비가역 선택: `be.arch.layering`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴). `be.arch.process-state`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.be-src}}`: server code의 위치
- `{{binding:repo-structure.be-tests}}`: server test의 위치
- `{{binding:repo-structure.be-config}}`: server package 최상위 설정 파일의 위치

## transaction-concurrency-idempotency

`Domain/SWE/Web/BE/transaction-concurrency-idempotency`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### be.txn.isolation-default

- 수준: `code-pattern`
- 질문: transaction 격리 수준 기본값을 무엇으로 할까?
- 선택지:
  - DB 기본값 + 필요한 곳만 높임: DB의 기본 격리 수준을 쓰고 경쟁이 있는 판정만 높인다. 경쟁이 있는 판정만 비용을 내지만 높일 곳을 찾아야 한다
  - 모두 가장 높은 격리(serializable): 모든 transaction을 가장 높은 격리로 돌린다. 경쟁을 빠뜨리지 않지만 직렬화 실패와 재시도가 늘고 처리량이 떨어진다. 근거 기록 없이 일괄로 두면 연결된 기준 항목 `web-be-transaction-concurrency-idempotency.md E4`이 결함으로 본다
  - 경우마다 정함: 기본값 없이 transaction마다 고른다. 유연하지만 기준이 없어 일관성이 떨어진다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 호출부별로 조정한다
- 기본값: DB 기본값 + 필요한 곳만 높임. 경쟁이 있는 판정만 비용을 낸다. 높인 곳에는 직렬화 실패 재시도를 함께 둔다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 transaction helper 호출부
- 기준 항목: [web-be-transaction-concurrency-idempotency.md E1](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e1-read-check-write-보호), [web-be-transaction-concurrency-idempotency.md E4](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e4-격리-수준lock-선택과-재시도)

#### be.txn.idempotency-trigger

- 수준: `code-pattern`
- 질문: 어떤 요청에 멱등 key를 받을까?
- 선택지:
  - 재시도·중복이 실제로 생기는 상태 변경만: client 재시도·재전송·중복 제출이 생기는 변경에만 멱등 key(같은 요청임을 알리는 값)를 받는다. 필요한 곳에서 두 번 처리를 막고 나머지는 단순하지만 재시도가 생기는 곳을 찾아야 한다
  - 모든 상태 변경: 상태를 바꾸는 모든 요청에 멱등 key를 받는다. 빠뜨리지 않지만 key 저장과 비교 비용이 모든 요청에 붙는다. 재시도·중복이 생기지 않는 상태 변경까지 넣으면 연결된 기준 항목 `web-be-transaction-concurrency-idempotency.md E2`이 결함으로 본다
  - 받지 않음: 멱등 key를 쓰지 않는다. 가장 단순하지만 재시도가 같은 변경을 두 번 할 수 있다. 재시도·중복 제출이 생기는데 unique 제약 같은 다른 중복 방지가 없으면 연결된 기준 항목 `web-be-transaction-concurrency-idempotency.md E2`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 진입점별로 더한다
- 기본값: 재시도·중복이 실제로 생기는 변경만. 필요한 곳에서 두 번 처리를 막고 나머지는 단순하게 둔다. unique 제약으로 중복이 막히면 key 없이 충분하다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 멱등 key 처리, 같은 요청을 두 번 보내는 test
- 기준 항목: [web-be-transaction-concurrency-idempotency.md E2](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e2-중복재시도-멱등성)

#### be.txn.side-effect-delivery

- 수준: `architecture-style`
- 질문: commit 뒤 부수효과(메일·알림·event)를 어떻게 보낼까?
- 선택지:
  - outbox table + 발송 작업: 변경과 같은 transaction에 보낼 내용을 기록하고, 따로 도는 발송 작업이 commit된 기록만 보낸다. rollback된 변경은 나가지 않고 발송 실패가 기록에 남지만 발송 작업과 table을 운영해야 한다
  - commit 뒤 바로 호출(실패 시 재시도·보상): commit이 끝난 뒤 바로 보내고, 실패하면 다시 보내거나 되돌리는 처리를 한다. 구조가 단순하지만 commit과 발송 사이에 process가 멈추면 발송을 놓칠 수 있다
  - transaction 안에서 호출: 변경과 같은 transaction 안에서 보낸다. code가 가장 단순하지만 rollback돼도 이미 나가고 외부 지연이 transaction을 붙잡는다. 연결된 기준 항목 `web-be-transaction-concurrency-idempotency.md E3`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 발송 경로와 실패 처리를 다시 쓴다
- 기본값: 놓치면 안 되는 부수효과는 outbox, 놓쳐도 되는 알림은 commit 뒤 바로 호출. rollback된 변경의 메일이 나가지 않고 발송 실패가 기록에 남는다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 발송 code와 transaction 경계
- 기준 항목: [web-be-transaction-concurrency-idempotency.md E3](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e3-부수효과와-commit-경계)

### 구현 지침

- [web-be-transaction-concurrency-idempotency.md E1](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e1-read-check-write-보호)
- [web-be-transaction-concurrency-idempotency.md E2](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e2-중복재시도-멱등성)
- [web-be-transaction-concurrency-idempotency.md E3](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e3-부수효과와-commit-경계)
- [web-be-transaction-concurrency-idempotency.md E4](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e4-격리-수준lock-선택과-재시도)

### 검증 기준

- `web-be-transaction-concurrency-idempotency.md E1`
- `web-be-transaction-concurrency-idempotency.md E2`
- `web-be-transaction-concurrency-idempotency.md E3`
- `web-be-transaction-concurrency-idempotency.md E4`

### 위험

- 확인과 쓰기 사이에 끼어드는 동시 요청과 함께 성공하는 종료 전이(E1), 두 번 처리되는 재시도·중복 요청(E2), transaction 안의 외부 호출과 commit 전 발송(E3), 근거 없는 최고 격리와 경로마다 다른 잠금 순서(E4)
- 비가역 선택: `be.txn.side-effect-delivery`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:repo-structure.be-src}}`: server code의 위치
- `{{binding:repo-structure.be-tests}}`: server test의 위치
- `{{binding:repo-structure.be-config}}`: server package 최상위 설정 파일의 위치

## background-integration-performance

`Domain/SWE/Web/BE/background-integration-performance`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)
- [web-operations-release-slo-signal.md O2](../../review-criteria/web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결)

### 결정 목록

#### be.bg.job-runner

- 수준: `architecture-style`
- 질문: background 작업을 무엇으로 돌릴까?
- 선택지:
  - DB 기반 작업 table·lease: 할 작업을 DB table에 두고, instance가 기한이 있는 잠금(lease)을 잡아 하나씩 가져간다. 새 서비스 없이 여러 instance에서 한 번만 실행되지만 작업량이 많으면 DB 부하가 늘어난다
  - 별도 queue 서비스: 작업을 queue 서비스에 넣고 worker가 받는다. 작업량이 많아도 버티지만 새 dependency와 운영 대상이 생긴다
  - process 안 timer: 각 instance 안의 timer가 작업을 돌린다. 가장 단순하지만 instance마다 같은 작업이 돈다. instance가 둘 이상이거나 늘 수 있으면 연결된 기준 항목 `web-be-background-integration-performance.md E1`이 결함으로 본다
- 먼저 정할 결정: `be.txn.side-effect-delivery`
- 되돌림: `costly`. 작업 정의와 실행 경로를 옮긴다
- 기본값: DB 기반 작업 table·lease. 새 서비스 없이 여러 instance에서 한 번만 실행된다. 작업량이 측정으로 DB를 압박하면 queue 서비스를 검토한다(새 dependency는 [swe.md S7](../../review-criteria/swe.md#s7-dependency-도입과-version-의존-동작))
- 확인 단서: `{{binding:repo-structure.be-src}}`의 scheduler·worker, lease·잠금 test
- 기준 항목: [web-be-background-integration-performance.md E1](../../review-criteria/web-be-background-integration-performance.md#e1-background-작업-triggerowner중복-실행)

#### be.bg.provider-failure

- 수준: `policy`
- 질문: 외부 provider가 실패하면 기능을 열어 둘까 닫을까?
- 선택지:
  - 기능별로 정함(보안 검사는 닫고 알림은 열고 나중에 재시도): 기능마다 provider가 실패할 때의 동작을 정한다. 보안이 약해지지 않고 부가 기능 장애가 핵심 흐름을 막지 않지만 기능마다 정하고 test해야 한다
  - 모두 닫음: provider가 실패하면 그 provider를 쓰는 요청을 모두 실패시킨다. 안전하고 단순하지만 부가 기능의 장애가 핵심 흐름까지 막을 수 있다. 부가 기능 provider 실패로 핵심 요청까지 막으면 연결된 기준 항목 `web-be-background-integration-performance.md E2`이 결함으로 본다
  - 모두 열어 둠: provider가 실패해도 그 단계를 건너뛰고 진행한다. 사용자 흐름이 끊기지 않지만 provider가 맡던 검사가 빠진다. provider가 인증·남용 방어 같은 보안 검사를 맡으면 연결된 기준 항목 `web-be-background-integration-performance.md E2`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 기능별로 조정한다
- 기본값: 기능별로 정함. 보안이 약해지지 않으면서 부가 기능 장애가 핵심 흐름을 막지 않는다. 값(어떤 기능을 열지)은 정책이 소유한다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 provider adapter 실패 처리, 실패 주입 test
- 기준 항목: [web-be-background-integration-performance.md E2](../../review-criteria/web-be-background-integration-performance.md#e2-외부-호출-timeoutretryfail-openclosed), [web-operations-release-slo-signal.md O3](../../review-criteria/web-operations-release-slo-signal.md#o3-실패-동작과-성능가용성-budget)

#### be.bg.remote-client

- 수준: `code-pattern`
- 질문: 외부 호출 client를 어떻게 만들까?
- 선택지:
  - 공통 client(timeout·retry·정제 기본값): timeout·재시도·log 정제 기본값을 가진 client 하나를 모든 외부 호출이 쓴다. 기본값이 빠지지 않지만 provider마다 다른 요구를 option으로 열어 줘야 한다
  - 호출하는 곳마다 직접: 호출하는 code마다 client를 만든다. 호출마다 자유롭게 정하지만 timeout·재시도를 곳마다 넣어야 해 빠뜨리기 쉽고, 기록은 공통 정제 경로를 따로 거쳐야 한다
  - provider SDK 기본값 그대로: provider가 주는 SDK를 기본 설정으로 쓴다. 바로 쓸 수 있지만 timeout·재시도 기본값이 SDK마다 다르다. SDK 기본값에 timeout이 없으면 연결된 기준 항목 `web-be-background-integration-performance.md E2`이 결함으로 본다
- 먼저 정할 결정: `be.bg.provider-failure`
- 되돌림: `easy`. client를 바꾼다
- 기본값: 공통 client. timeout·재시도·log 정제가 빠지지 않는다. provider가 하나뿐이면 그 adapter 안에 같은 기본값을 둔다
- 확인 단서: `{{binding:repo-structure.be-src}}`의 provider adapter, timeout test
- 기준 항목: [web-be-background-integration-performance.md E2](../../review-criteria/web-be-background-integration-performance.md#e2-외부-호출-timeoutretryfail-openclosed), [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)

### 구현 지침

- [web-be-background-integration-performance.md E1](../../review-criteria/web-be-background-integration-performance.md#e1-background-작업-triggerowner중복-실행)
- [web-be-background-integration-performance.md E2](../../review-criteria/web-be-background-integration-performance.md#e2-외부-호출-timeoutretryfail-openclosed)
- [web-be-background-integration-performance.md E3](../../review-criteria/web-be-background-integration-performance.md#e3-querypoolquota-포화-후보)
- [web-be-background-integration-performance.md E4](../../review-criteria/web-be-background-integration-performance.md#e4-code가-내는-운영-신호)

### 검증 기준

- `web-be-background-integration-performance.md E1`
- `web-be-background-integration-performance.md E2`
- `web-be-background-integration-performance.md E3`
- `web-be-background-integration-performance.md E4`

### 위험

- 여러 instance에서 겹쳐 도는 작업과 호출되지 않는 worker(E1), timeout 없는 원격 호출과 provider 실패 때 열리는 보안 검사, 부가 기능 실패로 막히는 핵심 요청(E2), 반복 안 query와 측정 없이 바꾼 pool·quota(E3), 구조·상관 id·원인 맥락 없는 log(E4), 정제 없이 기록한 외부 호출 payload(상속한 data-privacy-secret P4), 대응 행동 없는 alert(상속한 slo-signal O2)
- 비가역 선택: 없음. `be.bg.job-runner`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.be-src}}`: server code의 위치
- `{{binding:repo-structure.be-tests}}`: server test의 위치
- `{{binding:repo-structure.be-config}}`: server package 최상위 설정 파일의 위치
