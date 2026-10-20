# Web BE domain model and invariant criteria

[Review criteria](./README.md)의 `web-be-domain-model-invariant` 기준입니다. Server 업무 규칙의 owner, 상태를 가진 model,
domain 사이 호출, 상태 전이·선행 조건·종료 상태를 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 E1 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도), E2 → [swe.md S1](./swe.md#s1-요구사항intentinvariant-부합)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### E1. capability·aggregate owner

- 질문: 같은 상태를 바꾸는 규칙의 owner가 하나이고, owner를 controller·화면 이름으로 정하지 않으며, 다른 domain의 규칙은 복제하지 않고 그 owner를 호출하는가?
- 기본 severity: `medium`
- 적용 조건: 새 use case, 상태를 가진 model, domain 사이 호출을 더하거나 옮기는 변경
- 결함 패턴: controller·화면 이름으로 owner를 정함, 다른 domain의 규칙을 호출하지 않고 복제함(인증 code가 다른 domain invariant를 복사하는 등), 같은 상태를 두 owner가 바꿈
- PASS 근거: 바뀐 상태마다 그 상태를 바꾸는 owner가 한 곳이라는 owner 문서나 module 경계 test가 있고, 다른 domain의 규칙이 필요한 곳은 그 domain의 공개 호출을 쓰며 같은 판정 code가 두 곳에 없다
- 지침: owner는 같은 상태를 함께 바꾸는 업무 규칙의 묶음(capability·aggregate)으로 정하고 진입점·화면 이름을 기준으로 삼지 않는다. 다른 domain의 규칙이 필요하면 그 owner를 호출한다. 기능이 아주 적으면 owner 하나로 시작하고 규칙이 갈릴 때 나눈다
- 피함: 진입점·화면마다 owner 만들기, 다른 domain invariant를 복사하기, 한 상태를 두 owner가 바꾸기

### E2. 상태 전이·선행 조건·종료 상태의 server 강제

- 질문: 허용하는 상태 전이·선행 조건·종료 상태를 server가 강제해 금지 전이와 종료 상태 뒤의 변경을 거부하고, 미완성 draft를 확정 상태와 나누며, server가 화면에 행동 가능 여부(action capability)를 주면 그 값이 command의 선행 조건과 같은가?
- 기본 severity: `high`
- 적용 조건: 상태 전이·선행 조건·종료 상태를 더하거나 바꾸는 command
- 결함 패턴: 금지 전이를 막는 server 검사가 없음, 선행 조건을 client 표시에만 맡김, 종료 상태 뒤의 변경을 받음, 미완성 draft와 확정 상태를 섞음, 화면에 주는 action capability가 transaction 선행 조건과 어긋남
- PASS 근거: 상태 전이 표(actor·대상·허용 전이·선행 조건·종료 상태)가 변경 설명이나 owner 문서에 있고, 금지 전이와 종료 상태 뒤의 변경을 server가 거부하는 test가 있으며, server가 화면에 행동 가능 여부를 주면 그 값을 command 선행 조건과 같은 판정에서 계산한다
- 지침: actor·대상·상태 전이·선행 조건·종료 상태·금지 전이를 먼저 적고 server가 강제한다. 판정은 server의 업무 규칙(policy) code나 DB 조건부 갱신·제약이 맡고, 동시 요청이 같은 상태를 바꿀 수 있으면 DB가 마지막에 막게 한다. 확정 전 draft는 확정 상태와 나눠 둔다. server가 화면에 행동 가능 여부를 주면 command 선행 조건과 같은 판정에서 계산한다
- 피함: 선행 조건을 화면 표시로만 막기, 종료 상태 뒤의 변경 받기, draft와 확정 상태 섞기
