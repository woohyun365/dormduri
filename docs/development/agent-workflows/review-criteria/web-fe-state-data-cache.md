# Web FE state, data, and cache criteria

[Review criteria](./README.md)의 `web-fe-state-data-cache` 기준입니다. Web frontend에서 화면 상태·server data·URL 상태,
form·mutation, cache 무효화와 identity 전환, data hook, 외부 입력 검증을 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 강화만 합니다. 강화 관계는 F1 →
[swe.md S11](./swe.md#s11-응집도와-중복-trade-off), F2·F3·F4·F6 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), F5 →
[swe.md S10](./swe.md#s10-예측-가능성)입니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### F1. 상태 종류와 단일 원천

- 질문: 각 상태가 종류(화면 local·server data·URL·form)에 맞는 원천 하나를 갖고, 계산할 수 있는 값을 따로 저장하지 않는가?
- 기본 severity: `medium`
- 적용 조건: 화면 상태·server data·URL 상태의 보관 위치를 더하거나 바꾸는 변경
- 결함 패턴: 다른 상태로 계산할 수 있는 값을 별도 상태로 저장해 어긋남, server data를 전역 store에 복사해 원천이 둘이 됨, 공유·새로고침에 의미가 있는 filter·tab·page를 URL 밖에 둠, 상태를 맞추려고 effect를 연쇄로 둠
- PASS 근거: 바뀐 상태마다 원천 위치가 하나이고, 파생 값은 render 중 계산되며, URL 상태가 새로고침·공유 뒤 복원되는 test나 확인이 있다
- 지침: 상태를 종류별로 나누고 원천을 하나로 둔다. 파생 값은 저장하지 않고 계산한다. 공유·새로고침에 의미가 있는 상태는 URL에 둔다
- 피함: 같은 data를 두 store에 두기, 동기화용 effect, 화면 이동에 필요한 상태를 memory에만 두기

### F2. 모든 UI 상태

- 질문: data를 보여 주거나 action을 여는 화면이 load·빈 결과·오류·오래된 data·권한 없음·차단·종료 상태를 모두 갖고, 각 상태가 다음 행동을 안내하는가?
- 기본 severity: `medium`
- 적용 조건: data를 보여 주거나 action을 여는 화면·부품을 더하거나 바꾸는 변경
- 결함 패턴: 성공 상태만 구현함, 빈 결과와 오류를 같은 화면으로 보여 줌, 오래된 data를 최신처럼 보여 줌, 권한 없음·차단·종료된 대상에서 action이 열려 있음, 오류 문구가 다음 행동을 안내하지 않음
- PASS 근거: 바뀐 화면의 상태 목록과 상태마다 render를 확인하는 test나 예시 fixture가 있다
- 지침: 구현 전에 화면의 상태 목록(load·빈 결과·오류·오래된 data·권한 없음·차단·종료)을 정하고 상태마다 표시와 다음 행동을 정한다
- 피함: 오류를 빈 결과로 보이기, 끝나지 않는 load 표시, 상태별 문구를 code 곳곳에 흩기

### F3. form·mutation과 optimistic 반영

- 질문: form 제출과 상태 변경 요청이 검증·대기·중복 제출·재시도·오류 안내·focus를 다루고, optimistic 반영에 rollback과 충돌 의미가 있는가?
- 기본 severity: `medium`
- 적용 조건: form 제출, 상태 변경 요청, optimistic 반영을 더하거나 바꾸는 변경
- 결함 패턴: 대기 중 중복 제출을 막지 않음, 실패 뒤 입력이 사라지거나 오류 위치로 focus가 가지 않음, server 거부 사유를 일반 오류로 뭉침, rollback 없이 optimistic 반영해 실패 뒤 화면이 거짓 상태로 남음, server 판단 전에 성공 문구를 보임
- PASS 근거: 성공·검증 실패·server 거부·network 실패·중복 제출 경로를 실행하는 test가 있고, optimistic 반영이면 rollback test가 있다
- 지침: 제출 전후 상태(대기·성공·실패)와 중복 제출 방지를 정하고, 실패하면 입력을 보존한 채 오류 위치로 focus를 옮긴다. optimistic 반영은 rollback과 충돌 의미가 분명한 동작에만 쓴다
- 피함: server 확인 전 성공 단정, 실패 뒤 입력 초기화, 오류 사유 구분 없애기

### F4. 무효화·경쟁·identity 전환

- 질문: data 변경·화면 이동·계정 전환 뒤 화면이 최신 상태와 현재 identity의 data만 보이는가?
- 기본 severity: `medium`
- 적용 조건: cache 무효화·새로고침·뒤로·앞으로 이동·요청 취소, login·logout·계정·문맥 전환을 다루는 변경
- 결함 패턴: 변경 요청 뒤 관련 cache를 무효화하지 않음, 늦게 도착한 이전 요청 응답이 새 상태를 덮음, 화면을 떠난 뒤에도 요청이 남아 상태를 바꿈, 계정 전환 뒤 이전 사용자의 data가 cache에서 보임
- PASS 근거: 변경 요청마다 무효화 대상 목록이 있고, 경쟁 응답·취소·identity 전환을 재현하는 test가 있다
- 지침: 변경 요청마다 무효화할 data를 정하고, 요청에는 취소나 최신 응답만 반영하는 기준을 둔다. identity가 바뀌면 사용자별 cache를 비운다
- 피함: 전체 새로고침으로 무효화를 대신하기, 응답 도착 순서에 기대기, identity와 무관한 key로 사용자 data를 cache하기

### F5. 같은 종류 조회 hook의 계약

- 질문: 같은 종류의 data 조회·변경 hook이 같은 반환 형태와 오류 표현을 쓰는가?
- 기본 severity: `low`
- 적용 조건: data 조회·변경 hook을 더하거나 반환 형태를 바꾸는 변경
- 결함 패턴: 어떤 hook은 상태 객체를, 어떤 hook은 data만 돌려줘 호출부가 hook마다 다르게 다룸, 오류를 hook마다 다른 방식(throw·반환·무시)으로 표현함
- PASS 근거: 새·바뀐 hook이 같은 종류 기존 hook과 같은 반환 형태·오류 표현을 쓰거나, 다르게 둔 이유가 변경 설명에 있다
- 지침: 같은 종류 hook의 반환 형태와 오류 표현을 하나로 정하고 새 hook을 그 형태에 맞춘다
- 피함: hook마다 다른 반환 모양, 일부 hook만 오류를 삼키기

### F6. 외부 입력 신뢰 경계와 client 판단의 한계

- 질문: API 응답·URL·browser 저장소·message 같은 외부 입력을 경계에서 runtime 검증하고, client의 숨김·비활성을 최종 권한 판단으로 쓰지 않는가?
- 기본 severity: `medium`
- 적용 조건: API 응답·URL parameter·browser 저장소·window message를 읽는 code, action 노출 조건을 바꾸는 변경
- 결함 패턴: 외부 입력을 runtime 검증 없이 type 단언으로 씀, 검증 schema를 화면마다 따로 둠, UI에서 숨기거나 비활성화한 것을 권한 검사로 셈, URL·저장소 값을 검증 없이 화면·요청에 씀
- PASS 근거: 외부 입력이 들어오는 경계에서 공유 schema로 검증하는 위치와 잘못된 입력 test가 있고, 숨긴 action도 server가 거부한다는 test나 근거가 있다
- 지침: 외부 입력은 경계에서 공유 schema로 검증하고 이후 code는 검증된 type만 다룬다. action 노출은 사용성 판단이고 권한은 server가 판정한다
- 피함: type 단언으로 검증을 대신하기, client 판단만으로 권한을 보장한다고 주장하기
