# Web infra topology, runtime, and configuration criteria

[Review criteria](./README.md)의 `web-infra-topology-runtime-config` 기준입니다. 배포 구성 문서·설정과 환경 차이, build artifact와
환경 설정·secret 주입 흐름, container·process 실행 설정, 노출 port·ingress·TLS·권한·CI token·운영자 접근, 선언형 설정·IaC와
수동 console 작업의 경계를 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-data-privacy-secret.md P4](./web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 I1 → [swe.md S1](./swe.md#s1-요구사항intentinvariant-부합), I2 →
[swe.md S5](./swe.md#s5-계약-호환성), I3 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), I4·I5 → [swe.md S4](./swe.md#s4-책임-경계와-결합도)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### I1. 현재·목표 topology와 환경 차이 구분

- 질문: 배포 구성의 현재 상태(확인한 증거가 있는 것)와 목표 상태를 나눠 적고, local·CI·rehearsal·production 사이의 설정·network·secret·data·증거 차이를 밝히며, 제품·운영 화면·관측의 신뢰 경계와 장애 경계를 구분하는가?
- 기본 severity: `low`
- 적용 조건: 배포 구성 문서·설정을 더하거나 바꾸는 변경
- 결함 패턴: 현재와 목표 구성을 한 그림에 추측으로 섞음, local·CI·rehearsal·production의 차이를 적지 않음, 제품·운영 화면·관측의 신뢰·장애 경계를 구분하지 않음
- PASS 근거: 구성 문서에 현재 구성과 목표 구성이 따로 있고 현재 구성의 요소마다 확인 근거(설정 파일·실행 기록)가 있으며, 환경별 차이 표가 있고, 제품·운영 화면·관측이 어떤 경계로 나뉘며 한쪽 장애가 다른 쪽에 어떤 영향을 주는지 적혀 있다
- 지침: 공개 진입점·내부 서비스·상태를 가진 의존 서비스·관리형 provider·운영자 경로를 확인한 증거로 그린다. 목표 구성은 따로 표시하고 확인하지 않은 값을 추측으로 채우지 않는다. 환경마다 다른 설정·network·secret·data·증거를 표로 둔다
- 피함: 현재와 목표를 한 그림에 섞기, 확인하지 않은 구성을 현재처럼 쓰기, 환경 차이를 적지 않기

### I2. 불변 artifact와 config·secret 주입 흐름

- 질문: 이 저장소가 build하는 artifact를 한 번 만들어 같은 내용 그대로 환경 사이에 옮기고(같은 tag에 다른 내용을 다시 올리지 않고), 공개 설정·secret·대상 환경 입력을 나눠 실행할 때 주입하며, 자리표시 값이 production으로 넘어가지 않게 막는가?
- 기본 severity: `high`
- 적용 조건: build·image·환경 설정·secret 주입을 바꾸는 변경
- 결함 패턴: 같은 tag를 다른 내용으로 다시 씀, 환경마다 image를 다시 build함, placeholder 값이 production으로 넘어감, 공개 설정과 secret을 한 파일에 둠
- PASS 근거: build 한 번에서 나온 artifact 식별자(digest나 다시 쓰지 않는 tag)가 환경마다 같고, 공개 설정과 secret이 다른 파일·저장소에 있으며, production 배포 전에 자리표시 값이 남았는지 검사하는 단계와 그 test가 있다
- 지침: source → build → 불변 artifact → 설정·secret 주입 → 실행 → 증거 흐름을 적는다. artifact는 한 번 build해 내용 식별자로 환경 사이에 옮기고, 환경 차이는 설정 주입으로만 둔다. 공개 설정과 secret을 나누고, secret은 배포할 때 secret 저장소나 읽기 권한을 좁힌 host 환경 파일에서 넣는다. 생성 artifact는 정해진 위치와 schema·검증기를 갖는다
- 피함: 같은 tag에 다른 build를 다시 올리기, 환경마다 다시 build하기, 공개 설정과 secret을 한 파일에 두기, 자리표시 값을 그대로 배포하기

### I3. runtime 강화

- 질문: container·process가 root가 아닌 사용자로, 쓰기가 필요한 경로만 쓸 수 있는 filesystem으로 실행되고, health·readiness 확인과 시작·종료 순서, 종료 신호 처리가 있는가?
- 기본 severity: `medium`
- 적용 조건: container·process 실행 설정을 바꾸는 변경
- 결함 패턴: root로 실행함, 쓰기 가능한 filesystem, health·readiness가 없음, 시작·종료 순서와 종료 신호 처리가 없음
- PASS 근거: 실행 설정에 root가 아닌 사용자와 읽기 전용 filesystem(쓰기가 필요한 경로만 따로 둠)이 있고, health·readiness 확인과 의존 서비스 시작 순서가 설정에 있으며, 종료 신호를 받으면 진행 중인 작업을 정리하고 끝난다는 확인 기록이 있다
- 지침: root가 아닌 사용자로 실행하고, filesystem은 읽기 전용으로 두되 쓰기가 필요한 경로만 따로 연다. health·readiness 확인을 두고 의존 서비스가 준비된 뒤 시작하며, 종료 신호를 받으면 새 요청을 받지 않고 진행 중인 작업을 정리한 뒤 끝낸다
- 피함: root로 실행하기, 전체를 쓸 수 있는 filesystem, health 확인 없는 실행, 종료 신호 무시

### I4. network·identity 최소 권한과 운영자 접근

- 질문: 외부에 여는 port·진입점이 필요한 것뿐이고, 사람·workload·CI에 준 권한이 작업에 필요한 범위로 좁으며, CI가 오래 사는 자격 증명 대신 실행마다 발급되는 짧은 token을 쓰고, 비상 접근 경로와 그 회수 절차가 있는가?
- 기본 severity: `high`
- 적용 조건: 노출 port·ingress·TLS·IAM·CI token·운영자 접근을 바꾸는 변경
- 결함 패턴: 필요 없는 port를 공개함, 넓은 권한 역할, 오래 사는 CI 자격 증명, 비상 접근 경로와 그 회수 절차가 없음
- PASS 근거: 노출 port·진입점 목록이 설정과 같고 내부 서비스는 사설 network에만 있으며, 역할마다 권한 목록과 그 이유가 있고, CI가 실행마다 발급되는 짧은 token을 쓰며, 비상 접근 절차에 사용 기록과 회수 단계가 있다
- 지침: 외부에 여는 port·진입점은 꼭 필요한 것만 두고 TLS·DNS·CORS·cookie 설정을 함께 확인한다. 사람·workload·CI 역할마다 필요한 권한만 주고, CI는 workload identity 연동처럼 실행마다 발급되는 짧은 token을 쓴다. 비상 접근(break-glass) 경로를 미리 정하고 쓴 뒤에는 회수하고 기록한다
- 피함: 필요 없는 port 공개, 넓은 권한 하나로 모든 작업하기, 오래 사는 CI 자격 증명, 회수 절차 없는 비상 접근

### I5. 선언형 config·IaC owner와 drift

- 질문: 설정마다 원본이 하나이고(저장소의 선언형 설정이나 console과 그 변경 기록 가운데 하나), 원본이 선언형 설정이면 console에서 따로 바뀐 값을 찾아내며, 생성물마다 owner가 있는가?
- 기본 severity: `medium`
- 적용 조건: 선언형 설정·IaC와 수동 console 작업의 경계를 바꾸는 변경
- 결함 패턴: console에서 고친 값이 code와 어긋남(drift), 같은 책임의 원본이 둘, 생성물 owner가 없음
- PASS 근거: 설정마다 원본 위치가 owner 문서에 하나로 적혀 있고, 원본이 선언형 설정이면 실제 값과의 차이를 찾는 검사나 절차가 있으며, 원본이 console이면 값과 변경 기록이 있고, 생성물마다 만드는 script와 owner가 있다
- 지침: 설정마다 원본을 하나 정한다. 원본이 저장소의 선언형 설정이면 console에서 따로 고치지 않고 실제 값과의 차이를 찾으며 가져오기·맞추기 경계를 정한다. 원본이 console이면 값과 변경 절차를 기록한다. 생성물은 만드는 script와 owner를 갖는다
- 피함: 같은 설정을 저장소와 console 두 곳에서 고치기, 선언형 설정을 console에서 고치고 원본에 되돌려 놓지 않기, owner 없는 생성물
