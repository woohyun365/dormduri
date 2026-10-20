# Web infra data durability and recovery criteria

[Review criteria](./README.md)의 `web-infra-data-durability-recovery` 기준입니다. backup·restore·보존 설정, DB에 접속하는
script·test·운영 도구, DB·storage version·연결·migration 순서를 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 operations-release 항목
[web-operations-release-release-gate.md O2](./web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 I1 → [swe.md S6](./swe.md#s6-보호-test), I2 →
[swe.md S3](./swe.md#s3-정확성과-오류-경로), I3 → [swe.md S5](./swe.md#s5-계약-호환성)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### I1. restore 증거로 증명하는 backup·RPO/RTO

- 질문: 다시 만들 수 없는 data에 backup이 있고, 그 backup을 정해진 주기와 큰 변경 전에 restore로 시험해 증거를 남기며, 잃어도 되는 data의 시간 범위(RPO)와 복구까지 걸릴 시간(RTO) 목표가 있는가?
- 기본 severity: `high`
- 적용 조건: backup·restore·보존 설정을 바꾸는 변경
- 결함 패턴: 다시 만들 수 없는 data에 backup이 없음, backup 성공만 확인하고 restore를 시험하지 않음, RPO/RTO 목표가 없음
- PASS 근거: data 저장소마다 다시 만들 수 있는지와 backup 방식이 owner 문서에 있고, 다시 만들 수 없는 data의 backup에는 정해진 주기와 큰 변경 전마다 restore 시험 기록(시점·대상·걸린 시간·결과)이 있으며, RPO/RTO 목표가 있고 backup이 있으면 restore 시험 결과를 그 목표와 비교한 기록이 있다
- 지침: 저장소마다 다시 만들 수 있는 data인지 먼저 가르고, 다시 만들 수 없는 data는 backup한다. backup 성공이 아니라 restore 시험으로 복구할 수 있음을 증명하고, 정해진 주기와 큰 schema 변경 전에 시험한다. RPO/RTO 목표를 정하고, backup이 있으면 restore 시험 결과를 그 목표와 비교한다
- 피함: backup 성공 기록만으로 복구할 수 있다고 쓰기, 사고가 난 뒤에야 restore를 해 보기, 목표 없는 backup

### I2. disposable DB와 운영 유사 endpoint 안전 gate

- 질문: 시험 script·test가 disposable DB에만 접속하도록 접속 대상을 확인하는 gate가 있고, 운영 data 조회는 masking과 읽기 전용 경로로 하며, 운영 DB에 쓰는 작업(restore로 덮어쓰기 포함)은 사람이 승인한 뒤 실행하는가(정해진 주기로 운영 DB에 접속하는 작업은 그 실행 경로와 접속 대상을 만들거나 바꿀 때 승인)?
- 기본 severity: `high`
- 적용 조건: DB에 접속하는 script·test·운영 도구를 더하거나 바꾸는 변경
- 결함 패턴: 시험 script가 운영 유사 DB에 접속할 수 있음, 접속 대상을 확인하는 gate가 없음, 운영 data 조회에 masking·읽기 전용 경로가 없음
- PASS 근거: DB에 접속하는 script·test가 접속 대상(host·이름·환경 표시)을 확인해 disposable 대상이 아니면 멈추는 gate와 그 negative test가 있고, 운영 data 조회 경로가 읽기 전용 계정과 masking을 쓰며, 운영 DB에 쓰는 작업 앞에 사람 승인 지점이 있고 정해진 주기로 운영 DB에 접속하는 작업에는 경로 승인 기록과 실행 기록이 있다
- 지침: 시험과 restore 시험은 disposable DB에서 하고, 접속하기 전에 대상이 disposable인지 확인해 아니면 멈춘다. 운영 data를 봐야 하면 읽기 전용 계정과 masking을 쓴다. 운영 DB에 쓰는 작업은 agent가 계획까지 만들고 사람이 승인한 뒤 실행한다. 정해진 주기로 운영 DB에 접속하는 작업(주기 backup 등)은 그 실행 경로와 접속 대상을 만들거나 바꿀 때 사람이 승인하고, 승인된 경로의 주기 실행은 실행 기록을 남긴다
- 피함: 접속 대상 확인 없이 DB에 접속하는 시험 script, 운영 data를 masking 없이 조회하기, 사람 승인 없이 운영 DB에 쓰기

### I3. stateful 변경과 rollout 호환 구간

- 질문: DB·storage의 version·연결·migration 순서 변경이 app rollout과 rollback·forward-fix 구간에 맞고, 옛 version과 새 version이 함께 동작하는 호환 구간을 적었으며, pool·연결 설정 변경이 연결 한도와 부하에 주는 영향을 확인했는가?
- 기본 severity: `medium`
- 적용 조건: DB·storage version, 연결, migration 순서를 바꾸는 변경
- 결함 패턴: app rollout·rollback과 맞지 않는 stateful 변경, version 호환 구간을 적지 않음, pool·연결 설정 변경의 영향을 확인하지 않음
- PASS 근거: 변경 설명에 app 배포·되돌림 순서와 stateful 변경의 순서, 호환되는 version 범위가 있고, pool·연결 수 변경에는 DB 연결 한도와 instance 수로 계산하거나 측정한 확인이 있다
- 지침: DB·storage version을 올리거나 연결 설정·migration 순서를 바꿀 때 app rollout과 rollback·forward-fix가 실제로 함께 동작하는 구간을 적는다. pool·연결 수는 instance 수를 곱한 합이 DB 연결 한도 안에 드는지 확인한다
- 피함: app 되돌림과 맞지 않는 stateful 변경, 호환 구간 없이 version 올리기, 연결 한도 확인 없이 pool 늘리기
