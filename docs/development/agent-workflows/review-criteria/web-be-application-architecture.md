# Web BE application architecture criteria

[Review criteria](./README.md)의 `web-be-application-architecture` 기준입니다. Server code의 진입점·command·policy·repository 사이
흐름, module·디렉터리 구조와 공용 추상화, 다른 domain에 닿는 호출, process 메모리 상태와 설정 읽기를 더하거나 바꾸는 변경에
적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 E1 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도), E2 → [swe.md S11](./swe.md#s11-응집도와-중복-trade-off), E3 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도), E4 → [swe.md S3](./swe.md#s3-정확성과-오류-경로)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### E1. layer 흐름과 transport 누수

- 질문: 요청 parsing·cookie·client 주소·오류 응답 형식 같은 transport 세부가 진입점과 platform 공통 code에 머물고 업무 code(command·policy·repository)로 새지 않으며, 변경이 거치는 layer가 모두 하는 일이 있는가?
- 기본 severity: `medium`
- 적용 조건: 진입점·command·policy·repository 사이 흐름을 바꾸는 변경
- 결함 패턴: business code가 요청 parsing·cookie·client IP·오류 응답 형식을 직접 다룸, 같은 parsing을 여러 곳에서 반복함, 필요 없는 layer를 형식적으로 거침
- PASS 근거: 업무 code가 transport type·요청 객체를 import하지 않는다는 import 경계 test나 source 위치가 있고, 같은 parsing이 진입점 공통 위치 한 곳에 있으며, 새 layer마다 하는 일이 변경 설명에 있다
- 지침: transport 세부는 진입점과 platform 공통 code가 맡고 업무 code에는 값만 넘긴다. layer는 하는 일이 있을 때만 거치고, 작은 기능은 형식적인 층을 만들지 않는다. 구조 test는 import 방향과 공개 surface를 검사하고 파일 이름·위치 목록을 고정하지 않는다
- 피함: 업무 code에서 요청 객체를 직접 다루기, parsing을 곳마다 반복하기, 하는 일 없이 넘기기만 하는 layer, 구조 test에 과거 파일 이름 목록을 고정하기

### E2. flat 우선과 불필요 추상화 금지

- 질문: 작은 owner는 flat 구조를 유지하고 독립 lifecycle이 있을 때만 하위 slice를 만들며, 다시 내보내기만 하는 파일·잡동사니 utility·type 모음·실행 경로에 연결되지 않은 code를 더하지 않는가?
- 기본 severity: `low`
- 적용 조건: module·디렉터리 구조와 공용 추상화를 더하거나 바꾸는 변경
- 결함 패턴: 작은 owner에 중첩 slice를 만듦, 그대로 다시 내보내기만 하는 파일·잡동사니 utility·type 모음, 실행 경로에 연결되지 않은 code를 남김
- PASS 근거: 작은 owner에 새 하위 디렉터리를 만들면 그 독립 lifecycle(따로 바뀌는 이유)이 변경 설명에 있고, 새 파일·export마다 실행 경로의 호출부가 있다(검색 결과나 test)
- 지침: owner 안 파일은 한 디렉터리에 두고, 따로 바뀌는 이유가 생기면 하위 slice로 나눈다. 공용 code는 쓰는 곳이 생길 때 그 의미를 드러내는 이름으로 만든다
- 피함: 작은 owner에 층별 하위 디렉터리 만들기, 다시 내보내기만 하는 파일, 이름 없는 잡동사니 utility·type 파일, 호출부 없는 code

### E3. domain 간 공개 contract 호출과 table 공유 금지

- 질문: 다른 domain의 data·동작이 필요할 때 그 owner의 공개 service·contract를 호출하고 그 domain의 table·repository를 직접 읽고 쓰지 않으며, 운영 화면·지원 도구도 같은 owner를 거치는가?
- 기본 severity: `medium`
- 적용 조건: 다른 domain의 data·동작에 닿는 변경
- 결함 패턴: 다른 domain의 table·repository를 직접 읽고 씀, 공개 service를 우회해 내부 persistence를 호출함, 운영 화면·지원 도구가 제품 table을 직접 고침
- PASS 근거: 다른 domain 접근이 그 owner의 공개 호출로만 일어난다는 import 경계 test나 source 위치가 있고, 운영 화면·지원 도구의 변경이 제품 owner의 command를 거친다
- 지침: 다른 domain의 data는 그 owner의 공개 service·contract로 읽고 바꾼다. 운영 화면·지원 도구는 감사할 수 있는 제품 흐름(owner의 command)을 거쳐 바꾼다
- 피함: 다른 domain의 table·repository를 직접 쓰기, 공개 service를 우회한 내부 persistence 호출, 운영 도구로 제품 table 직접 고치기, 경계 test가 허용 파일 목록을 하나씩 고정하기

### E4. process 상태와 설정 주입

- 질문: instance가 둘 이상이거나 늘 수 있을 때 정확성을 process 메모리 상태(잠금·nonce·counter)에 기대지 않고, 여러 instance가 함께 써야 하는 실제 요구(그 공유 상태를 DB에 둔 부하가 측정으로 문제가 되는 경우 포함) 없이 범용 분산 저장소·cache port를 만들지 않으며, 설정·URL·자격 증명을 code에 고정하지 않고 실행 환경에서 주입하는가?
- 기본 severity: `medium`
- 적용 조건: process 메모리 상태, 설정·비밀값 읽기를 더하거나 바꾸는 변경
- 결함 패턴: instance가 늘면 틀리는 process 메모리 상태(잠금·nonce·counter)를 정확성 근거로 씀, 실제 요구 없이 범용 분산 저장소·cache port를 만듦, 설정·URL·자격 증명을 code에 고정함
- PASS 근거: process 메모리 상태마다 목적(잠금·nonce 소비·정리 lease 등)과 정확성 경계가 변경 설명에 있고, instance가 둘 이상이거나 늘 수 있으면 그 판정을 instance가 함께 쓰는 저장소에서 하는 test가 있으며, 설정은 실행 환경에서 읽고 예시 설정에는 자리표시 값만 있다
- 지침: process 메모리 상태는 자료 구조 이름보다 목적(잠금·nonce 소비·정리 lease)과 정확성 경계를 먼저 정한다. instance가 둘 이상이거나 늘 수 있으면 그 판정을 instance가 함께 쓰는 저장소로 옮기고, 새 공유 저장소·cache는 여러 instance가 함께 써야 하는 실제 요구(그 공유 상태를 DB에 둔 부하가 측정으로 문제가 되는 경우 포함)가 있을 때 들이고 범용 port로 미리 만들지 않는다(dependency 도입은 `swe.md` S7). 설정·URL·자격 증명은 실행 환경에서 주입한다
- 피함: instance가 늘 수 있는데 메모리 counter·잠금을 정확성 근거로 쓰기, 실제 요구 없이 범용 분산 저장소·cache port 만들기, code에 URL·자격 증명 고정하기
