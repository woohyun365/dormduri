# Web FE rendering boundary criteria

[Review criteria](./README.md)의 `web-fe-rendering-boundary` 기준입니다. Web frontend에서 render 위치, server·client 경계,
첫 render와 navigation, 체감 성능, 부분 실패와 browser 오류 관측을 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 F1 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도), F2·F4 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), F3 →
[swe.md S8](./swe.md#s8-측정-근거-있는-성능)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### F1. server·client 경계

- 질문: render 위치가 화면의 상호작용 필요와 맞고, server 전용 code·비밀값·큰 dependency가 client로 넘어가지 않는가?
- 기본 severity: `medium`
- 적용 조건: 화면의 render 위치, server·client 경계를 넘는 import와 값을 바꾸는 변경
- 결함 패턴: 상호작용이 없는 화면 전체를 client에서 render함, client 경계를 상위 layout에 두어 하위 전체가 client가 됨, server 전용 module·비밀값·큰 dependency가 client bundle에 들어감, 직렬화할 수 없는 값(함수·class instance 등)을 경계 너머로 넘김
- PASS 근거: 바뀐 화면의 client 경계 위치와 그 이유(상호작용·browser API)가 보이고, client bundle에 server 전용 module이 없다는 build 출력이나 import 검사가 있다
- 지침: 기본은 server render로 두고 상호작용·browser API가 필요한 가장 작은 부분만 client 경계로 만든다. server 전용 module은 client에서 import할 수 없게 표시하고, 경계로 넘기는 값은 직렬화할 수 있는 data로 제한한다
- 피함: 편의를 위해 상위 layout을 client로 바꾸기, 비밀값을 client용 환경변수로 노출하기, 경계 너머로 함수·instance 넘기기

### F2. render 일치와 navigation·scroll 소유

- 질문: server와 client의 첫 render가 같고, navigation 뒤 scroll·focus·overlay의 소유자가 정해져 있는가?
- 기본 severity: `medium`
- 적용 조건: 첫 render 결과, client navigation과 뒤로·앞으로 이동, overlay·scroll 위치를 바꾸는 변경
- 결함 패턴: 현재 시각·random 값·기기 판별·browser 전용 값 때문에 server와 client의 첫 render가 달라짐, navigation 뒤 scroll 위치·focus가 이전 화면 상태로 남거나 사라짐, overlay가 URL과 따로 열려 뒤로 가기에서 닫히지 않음
- PASS 근거: 첫 render에 쓰는 값이 server와 client에서 같은 원천이고, navigation·뒤로 가기 뒤 scroll·focus·overlay 상태를 확인하는 test나 기록이 있다
- 지침: 첫 render는 요청마다 같은 입력으로 정하고 browser 전용 값은 render 뒤에 읽는다. navigation마다 scroll·focus·overlay를 누가 정하는지 정하고 그 동작을 test한다
- 피함: 불일치 경고를 억제해 숨기기, render 중 browser 전역 값 읽기, overlay 상태를 여러 곳이 각자 소유하기

### F3. 체감 성능 budget

- 질문: 성능 주장·최적화와 bundle·image·font·hydration 비용 변화가 사용자 체감 지표와 측정값에 연결되는가?
- 기본 severity: `low`
- 적용 조건: 성능을 주장하거나 bundle 크기·image·font·hydration·첫 화면 data 비용을 바꾸는 변경
- 결함 패턴: 측정 없이 memoization·지연 load·cache를 더함, 큰 library를 들여 client bundle이 커지는데 크기를 보지 않음, 원본 크기 image나 render를 막는 font로 첫 화면이 늦어짐, 크기를 정하지 않은 media가 layout 이동을 만듦
- PASS 근거: 바뀐 화면의 체감 지표(load·반응·layout 이동)나 bundle 크기의 전후 측정값과 측정 환경이 있다
- 지침: 최적화 전에 체감 지표와 bundle 크기를 측정해 budget을 정한다. image·font는 크기와 우선순위를 정하고 media는 자리를 미리 잡는다
- 피함: 측정 없는 최적화, 체감 지표 대신 개발 환경의 느낌으로 판단하기, budget 없이 dependency로 bundle 늘리기

### F4. 부분 실패 격리와 browser 오류 관측

- 질문: 한 영역의 실패가 화면 전체를 깨뜨리지 않고, browser 오류가 개인정보 없이 관측되는가?
- 기본 severity: `medium`
- 적용 조건: 오류 경계와 대체 화면, browser runtime 오류 처리, 오류·telemetry 수집을 바꾸는 변경
- 결함 패턴: 독립 영역의 오류가 route 전체를 빈 화면으로 만듦, 대체 화면이 재시도나 다음 행동을 주지 않음, browser 오류가 수집되지 않아 사용자만 앎, 오류 보고에 입력값·token·식별자가 담김
- PASS 근거: 바뀐 영역의 오류 경계 위치와 대체 화면을 실행하는 test가 있고, 오류 보고 payload의 수집 field 목록이나 개인정보 제거 검사가 있다
- 지침: route와, 독립적으로 실패할 수 있는 영역에 오류 경계를 두고 대체 화면에 재시도나 다음 행동을 준다. browser 오류는 수집하되 개인정보를 빼는 filter를 수집 지점에 둔다
- 피함: 전역 경계 하나로 모든 오류 처리하기, 오류를 삼키고 빈 화면 두기, 원본 오류 객체를 그대로 보고하기
