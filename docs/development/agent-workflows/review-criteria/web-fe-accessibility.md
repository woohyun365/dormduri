# Web FE accessibility criteria

[Review criteria](./README.md)의 `web-fe-accessibility` 기준입니다. Web frontend에서 상호작용 요소의 의미와 이름,
keyboard와 focus, 동적 상태 알림과 비활성 이유를 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 F1·F2 →
[swe.md S1](./swe.md#s1-요구사항intentinvariant-부합), F3 → [swe.md S3](./swe.md#s3-정확성과-오류-경로)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### F1. 의미 있는 요소와 접근 가능한 이름

- 질문: 상호작용 요소가 의미에 맞는 native 요소이고, 모든 control·image·영역에 접근 가능한 이름이 있는가?
- 기본 severity: `medium`
- 적용 조건: 상호작용 요소·form control·heading·image·landmark를 더하거나 바꾸는 변경
- 결함 패턴: click 처리만 붙인 일반 요소를 button·link처럼 씀, native 요소로 될 일을 ARIA로 흉내 냄, label 없는 입력이나 이름 없는 icon button을 둠, heading 순서가 화면 구조와 다름
- PASS 근거: 바뀐 control을 역할과 이름으로 찾아 그 동작(누름·입력·링크 목적지)과 상태별 분기를 확인하는 test가 있고, 자동 접근성 검사가 있으면 위반이 없다
- 지침: 동작에 맞는 native 요소를 먼저 쓰고 모든 control에 보이는 label이나 접근 가능한 이름을 준다. ARIA는 native 요소로 표현할 수 없을 때만 쓴다. test도 control을 역할과 접근 가능한 이름으로 찾는다
- 피함: 일반 요소에 click만 붙이기, 불필요한 ARIA, 이름 없는 icon button, test에서 control을 역할 없이 보이는 문자열·DOM 위치·class로 찾기

### F2. keyboard와 focus

- 질문: 모든 상호작용을 keyboard로 할 수 있고, focus가 보이며 순서와 이동이 올바른가?
- 기본 severity: `medium`
- 적용 조건: 상호작용·overlay·navigation·focus 처리를 더하거나 바꾸는 변경
- 결함 패턴: keyboard로 열거나 닫을 수 없는 control을 둠, focus 표시를 지움, 화면 순서와 다른 focus 순서를 만듦, overlay가 열려도 focus가 배경에 남거나 닫힌 뒤 원래 위치로 돌아오지 않음
- PASS 근거: keyboard만으로 바뀐 흐름을 끝내는 test가 있고, overlay의 focus 이동·가둠·복귀를 확인하는 test가 있다
- 지침: 상호작용마다 keyboard 동작을 정하고 focus를 보이게 둔다. overlay는 열 때 focus를 옮겨 안에 가두고 닫을 때 원래 위치로 돌린다
- 피함: focus 윤곽선 제거, 양수 tab 순서 값, mouse 전용 동작

### F3. 상태 알림과 비활성 이유

- 질문: 동적 상태 변화와 오류가 보조기술에 전달되고, 비활성 action은 그 이유를 알려 주는가?
- 기본 severity: `medium`
- 적용 조건: 동적 상태·오류·비활성 action·정보 표시를 더하거나 바꾸는 변경
- 결함 패턴: 저장·오류·목록 갱신 같은 동적 변화를 보조기술에 알리지 않음, 오류를 색으로만 표시함, 비활성 action에 이유가 없음, 정보 card를 비활성 button처럼 보이게 함
- PASS 근거: 동적 변화의 알림 영역과 입력·오류 문구 연결을 확인하는 test가 있고, 비활성 action 가까이에 이유가 보인다
- 지침: 동적 변화는 알림 영역으로 전달하고 오류 문구를 해당 입력에 연결한다. action을 비활성화하면 이유와 할 수 있는 다음 행동을 보여 준다
- 피함: 색만으로 상태 표시하기, 이유 없는 비활성, 정보 표시를 control처럼 보이게 하기
