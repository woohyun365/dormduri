# Web BE background work, integration, and performance criteria

[Review criteria](./README.md)의 `web-be-background-integration-performance` 기준입니다. Server의 scheduler·worker·event consumer,
외부 provider·원격 호출과 그 실패 동작, 조회·반복 호출·pool·작업 주기, code가 내는 log·metric을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-data-privacy-secret.md P4](./web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제), operations-release 항목
[web-operations-release-slo-signal.md O2](./web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 E1·E2·E4 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), E3 →
[swe.md S8](./swe.md#s8-측정-근거-있는-성능)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### E1. background 작업 trigger·owner·중복 실행

- 질문: scheduler·worker·event consumer마다 trigger·owner·재시도·보존이 정해지고, instance가 둘 이상이거나 늘 수 있으면 같은 작업이 한 번만 실행되며, 실행 경로에 연결된 작업만 운영 준비로 세는가?
- 기본 severity: `medium`
- 적용 조건: scheduler·worker·event consumer를 더하거나 바꾸는 변경
- 결함 패턴: 여러 instance에서 같은 작업이 동시에 돎, trigger·owner·재시도·보존이 정해지지 않음, 호출되지 않는 worker를 운영 준비로 셈
- PASS 근거: 작업마다 trigger·owner·재시도·보존이 owner 문서나 변경 설명에 있고, instance가 둘 이상이거나 늘 수 있으면 lease·잠금 같은 방식으로 한 번만 실행된다는 test가 있으며, 새 worker의 호출부(scheduler 등록·consumer 구독)가 있다
- 지침: 작업마다 무엇이 시작하는지, 누가 소유하는지, 실패하면 어떻게 다시 하는지, 기록을 얼마나 두는지 정한다. instance가 둘 이상이거나 늘 수 있으면 작업 table의 lease나 queue처럼 한 번만 실행되는 방식을 쓴다. 실행 경로에 등록되지 않은 worker는 완료로 세지 않는다
- 피함: instance가 늘 수 있는데 process 안 timer로 작업 돌리기, owner·재시도가 없는 작업, 호출되지 않는 worker를 준비된 것으로 보고하기

### E2. 외부 호출 timeout·retry·fail-open/closed

- 질문: 외부 provider·원격 호출마다 timeout이 있고, 재시도는 멱등한 작업에만 backoff와 상한을 두며, 실패 때 열지 닫을지를 기능별로 정해 보안 검사는 닫고 부가 기능 provider의 실패가 핵심 요청을 막지 않는가?
- 기본 severity: `high`
- 적용 조건: 외부 provider·원격 호출을 더하거나 바꾸는 code
- 결함 패턴: timeout 없는 원격 호출, 멱등하지 않은 작업의 재시도·backoff 없는 즉시 재시도, 실패 때 열지 닫을지 정하지 않음, 인증·남용 방어 같은 보안 검사를 provider 실패 때 열어 둠, provider 오류가 사용자 요청 전체를 막음
- PASS 근거: 원격 호출마다 timeout 값과 실패 동작(열어 둠·닫음·저하)이 source나 변경 설명에 있고, timeout·실패를 주입한 test가 보안 검사는 거부로, 부가 기능은 핵심 요청의 성공으로 끝나는 것을 확인한다
- 지침: 원격 호출에는 timeout을 두고, provider SDK 기본값을 쓰면 그 기본값에 timeout이 있는지 확인한다. 재시도는 멱등한 작업에만 backoff와 횟수 상한을 둔다. 실패 동작은 기능별로 정해 보안 검사는 닫고, 부가 기능은 열어 두거나 나중에 다시 한다. 열지 닫을지의 값은 정책이 소유한다
- 피함: timeout 없는 원격 호출, 멱등하지 않은 작업 재시도하기, 보안 검사를 provider 실패 때 열어 두기, 부가 기능 provider의 실패로 핵심 요청 막기

### E3. query·pool·quota 포화 후보

- 질문: 바꾼 조회·반복 호출·pool·작업 주기에서 반복 안의 query(N+1)와 상한 없는 조회를 두지 않고, pool·quota 포화 후보를 측정이나 계산으로 확인했는가?
- 기본 severity: `medium`
- 적용 조건: 조회·반복 호출·pool·작업 주기를 바꾸는 변경
- 결함 패턴: 반복 안에서 query를 되풀이함(N+1), 상한 없는 조회, pool·quota 포화를 측정 없이 지나침
- PASS 근거: 바꾼 경로의 query 수가 입력 크기에 따라 늘지 않는다는 test나 query 기록이 있고, 조회마다 상한이 있으며, pool·provider quota·작업 주기를 바꾸면 예상 부하와 한도의 계산이나 측정 결과가 변경 설명에 있다
- 지침: 목록을 돌며 query를 부르지 않고 한 번에 가져온다. 조회에는 상한을 둔다. pool 크기·provider quota·작업 주기를 바꾸면 예상 부하와 한도를 계산하거나 측정해 남긴다
- 피함: 반복 안 query, 상한 없는 조회, 측정·계산 없이 pool·quota 바꾸기

### E4. code가 내는 운영 신호

- 질문: 오류 처리·log·metric을 더하는 server code가 구조화된 log와 요청 상관 id를 쓰고, 오류 log에 원인 맥락을 남기며, metric마다 답하는 운영 질문이 있는가?
- 기본 severity: `medium`
- 적용 조건: 오류 처리·log·metric을 더하거나 바꾸는 server code
- 결함 패턴: 구조화되지 않은 log, 상관 id 없음, 오류 log에 원인 맥락이 없음, 운영 질문 없는 metric
- PASS 근거: 새 log가 구조화된 필드와 상관 id를 갖고 오류 log에 원인(실패한 단계와 대상)이 있다는 test나 출력 예가 있으며, 새 metric마다 답하는 운영 질문이 변경 설명에 있다
- 지침: log는 구조화된 필드와 요청 상관 id로 남기고, 오류 log에는 실패한 단계와 대상 같은 원인 맥락을 담되 비밀값·개인정보는 공통 정제 경로로 뺀다. metric은 운영 질문에서 시작한다
- 피함: 문자열만 있는 log, 상관 id 없는 오류 log, 원인 없는 실패 log, 운영 질문 없는 metric
