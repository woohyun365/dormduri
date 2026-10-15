# Web FE component architecture criteria

[Review criteria](./README.md)의 `web-fe-component-architecture` 기준입니다. Web frontend에서 component의 owner·공통화,
component API, 분기 구조, 파일 배치와 import 경계, 부품 예시 fixture, renderer 중립 model을 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 F1·F4 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도)·[swe.md S11](./swe.md#s11-응집도와-중복-trade-off), F2·F6 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도), F3 → [swe.md S9](./swe.md#s9-가독성), F5 →
[swe.md S6](./swe.md#s6-보호-test)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### F1. owner 구분과 공통화 기준

- 질문: 새 부품이 page·flow·domain UI·공통 부품 가운데 맞는 owner에 있고, 기존 부품을 먼저 재사용하며, 공통화가 의미·상호작용·상태 계약이 같을 때만 일어나는가?
- 기본 severity: `medium`
- 적용 조건: page·flow·domain UI·공통 부품을 더하거나 공통 부품으로 올리는 변경
- 결함 패턴: 기존 부품을 찾지 않고 비슷한 부품을 새로 만듦, 겉모양만 같은 부품을 하나로 합쳐 분기가 늘어남, 이름만 바꾼 단순 re-export 부품을 만듦, data 조회·상태·표시를 모두 가진 거대한 component를 만듦
- PASS 근거: 새 부품마다 기존 부품 검색 결과와 owner 선택 이유가 있고, 공통화한 부품은 두 곳 이상에서 같은 의미·상호작용·상태 계약으로 쓰인다
- 지침: 만들기 전에 기존 부품을 찾고, 새 부품은 쓰는 범위에 맞는 가장 좁은 owner에 둔다. 공통 부품으로는 두 곳 이상에서 의미·상호작용·상태 계약이 같을 때 올린다
- 피함: 겉모양 기준의 공통화, 의미 없는 wrapper, 한 component에 여러 책임 모으기

### F2. 합성 먼저와 작은 component API

- 질문: component가 여러 단계 props 전달이나 늘어나는 boolean option 대신 합성(children·slot)으로 확장되고, API가 작은가?
- 기본 severity: `low`
- 적용 조건: component의 props·확장 방식을 더하거나 바꾸는 변경
- 결함 패턴: 쓰지 않는 중간 component를 거쳐 props를 여러 단계 전달함, boolean prop이 늘어 분기 조합이 커짐, 표시 component가 data 조회·business 규칙을 함께 가짐
- PASS 근거: 바뀐 component의 props가 그 component가 직접 쓰는 값이고, 변형은 합성이나 분리된 component로 표현된다
- 지침: 변형이 늘면 boolean option보다 합성이나 별도 component를 먼저 고려한다. 중간 단계가 쓰지 않는 값은 합성으로 필요한 곳에 직접 둔다. 표시와 data·규칙은 나눈다
- 피함: 모든 변형을 한 component의 option으로 받기, 전역 상태로 props 전달 문제를 덮기

### F3. 같이 실행되지 않는 분기 분리

- 질문: 동시에 실행되지 않는 권한·상태·mode별 분기를 각자의 component로 나눠 읽을 맥락을 줄였는가?
- 기본 severity: `low`
- 적용 조건: 권한·상태·mode에 따라 다른 화면을 보이는 component를 더하거나 바꾸는 변경
- 결함 패턴: 서로 배타적인 분기 여러 개가 한 component 안에서 조건문으로 섞여 한 분기를 읽을 때 다른 분기까지 읽어야 함, 분기마다 다른 effect·상태가 한 곳에 모임
- PASS 근거: 배타적인 분기가 분기 지점 하나에서 각자의 component로 나뉘고, 분기별 test가 있다
- 지침: 동시에 실행되지 않는 분기는 분기 지점 하나에서 갈라 각자의 component로 둔다
- 피함: 한 component에 모든 mode를 조건문으로 겹치기, 분기마다 다른 hook을 조건부로 섞기

### F4. 기능 단위 배치와 공개 entry

- 질문: 함께 바뀌는 파일이 기능 단위로 모여 있고, 다른 기능은 공개 entry로만 가져다 쓰는가?
- 기본 severity: `medium`
- 적용 조건: 파일·디렉터리 배치와 import 경로를 더하거나 바꾸는 변경
- 결함 패턴: 한 기능의 component·hook·utility가 종류별 디렉터리에 흩어져 한 기능 수정이 여러 디렉터리에 걸침, 다른 기능의 내부 파일을 직접 import함, 기능 사이에 순환 import가 생김
- PASS 근거: 바뀐 기능의 파일이 그 기능 디렉터리 안에 있고, 기능 밖 import가 공개 entry만 쓰며, import 경계 검사가 있으면 통과한다
- 지침: 함께 바뀌는 파일은 기능 디렉터리에 함께 두고 앱 공통만 종류별로 둔다. 다른 기능은 그 기능의 공개 entry로만 쓴다
- 피함: 기능 내부 경로를 직접 import하기, 한 기능의 파일을 종류별 디렉터리에 흩기

### F5. 예시 렌더 표면의 우회 금지

- 질문: 부품 예시·preview fixture가 production component와 같은 controller·contract로 render되는가?
- 기본 severity: `medium`
- 적용 조건: 부품 예시·preview·시각 검증 fixture를 더하거나 바꾸는 변경
- 결함 패턴: 예시가 production과 다른 별도 component·mock 동작으로 render되어 예시가 통과해도 실제 화면은 깨짐, fixture data가 production contract schema와 다름
- PASS 근거: 예시가 production component를 import하고 fixture가 공유 contract schema 검증을 통과한다
- 지침: 예시는 production component에 fixture data만 바꿔 넣어 render한다. fixture는 공유 contract로 만든다
- 피함: 예시 전용 복사 component, contract를 벗어난 fixture

### F6. renderer 중립 경계

- 질문: 다른 renderer와 공유할 화면 규칙·model이 DOM·style·특정 renderer API에 의존하지 않는가?
- 기본 severity: `medium`
- 적용 조건: 다른 renderer(예: native app)와 공유할 model·규칙·contract를 더하거나 바꾸는 변경
- 결함 패턴: 공유 model이 DOM type·style 값·특정 renderer의 hook을 import함, 화면 규칙이 표현 component 안에만 있어 다른 renderer가 다시 구현함
- PASS 근거: 공유 model 경로에 renderer 의존 import가 없다는 검사나 검색 결과가 있고, 규칙 test가 renderer 없이 실행된다
- 지침: 공유할 규칙과 model은 renderer 의존이 없는 module에 두고 표현 component는 그것을 소비만 한다
- 피함: 공유 model에서 DOM·style을 import하기, 규칙을 표현 component에 숨기기
