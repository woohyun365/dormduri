# Web FE layout, responsive, and device criteria

[Review criteria](./README.md)의 `web-fe-layout-responsive-device` 기준입니다. Web frontend에서 viewport·기기별 표현,
같은 URL의 기기별 전환, layout·고정 요소·overlay·scroll을 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 강화만 합니다. 강화 관계는 F1 →
[swe.md S11](./swe.md#s11-응집도와-중복-trade-off), F2 → [swe.md S1](./swe.md#s1-요구사항intentinvariant-부합), F3 →
[swe.md S6](./swe.md#s6-보호-test)입니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### F1. 표현 책임 판정

- 질문: viewport별 표현이 공유·분리·변경 없음 가운데 판정된 방식으로 나뉘고, 공통 행동·data는 하나로 남는가?
- 기본 severity: `medium`
- 적용 조건: viewport·기기별 표현을 더하거나 바꾸는 변경
- 결함 패턴: 판정 없이 화면을 mobile·desktop 두 벌로 복제함, 표현을 나누며 data 조회·action·상태 code까지 두 벌이 됨, 정보 위계가 같은데 표현을 나눔
- PASS 근거: 바뀐 화면의 표현 판정(공유·분리·변경 없음)과 이유가 있고, 나눈 표현이 같은 data·action module을 쓴다
- 지침: 먼저 표현을 판정하고, 정보 위계·탐색이 다를 때만 그 부분의 표현을 나눈다. 나눠도 data·action·상태는 공유한다
- 피함: 기기별로 화면을 통째로 복제하기, 표현마다 logic 복제하기

### F2. 같은 URL과 render 안전

- 질문: 같은 URL이 기기와 무관하게 같은 기능과 일치하는 첫 render를 주는가?
- 기본 severity: `medium`
- 적용 조건: 기기·viewport 판별, 같은 URL의 기기별 표현 전환을 더하거나 바꾸는 변경
- 결함 패턴: server의 기기 판별로 첫 render가 갈려 불일치·깜빡임이 생김, 같은 URL이 viewport에 따라 기능을 숨김, 기기 판별 결과를 cache key 없이 공유 cache에 둠
- PASS 근거: 기기별 표현 차이가 viewport·CSS 조건으로 처리되거나, server 판별이면 판별 값이 cache key에 들어가고 같은 기능이 유지된다는 test가 있다
- 지침: 기기 차이는 viewport·CSS 조건으로 먼저 처리한다. server 판별이 필요하면 cache key와 첫 render 일치를 함께 설계한다
- 피함: user-agent로 기능 숨기기, render 중 viewport 측정

### F3. viewport·scroll 검증

- 질문: layout·고정 요소·overlay·scroll 변경을 좁은 화면·확대·가상 keyboard를 포함한 viewport에서 확인했는가?
- 기본 severity: `medium`
- 적용 조건: layout·sticky·fixed 요소·portal·overlay·scroll 잠금을 바꾸는 변경
- 결함 패턴: 넓은 화면에서만 확인해 좁은 mobile·tablet에서 잘림·겹침이 남음, 확대·가상 keyboard에서 입력이 가려짐, scroll 소유자와 쌓임 순서를 추측해 overlay가 가려지거나 배경이 scroll됨
- PASS 근거: 바뀐 화면을 좁은 mobile·tablet·desktop viewport에서 실행한 test나 화면 기록이 있고, scroll 소유자와 쌓임 순서를 확인한 기록이 있다
- 지침: viewport 목록(좁은 mobile·tablet·desktop·확대)을 정하고 각각 확인한다. overlay는 scroll 소유자와 쌓임 순서를 정하고 확인한다
- 피함: 한 viewport 확인으로 완료하기, 쌓임 순서 값을 올려 겹침을 덮기
