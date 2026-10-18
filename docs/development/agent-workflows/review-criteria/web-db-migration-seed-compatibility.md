# Web DB migration, seed, and compatibility criteria

[Review criteria](./README.md)의 `web-db-migration-seed-compatibility` 기준입니다. DB migration과 schema 변경의 적용·되돌림 경로,
seed·reference data와 그 실행 경로를 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 operations-release 항목
[web-operations-release-release-gate.md O2](./web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 T1 → [swe.md S5](./swe.md#s5-계약-호환성), T2 →
[swe.md S6](./swe.md#s6-보호-test), T3 → [swe.md S3](./swe.md#s3-정확성과-오류-경로)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### T1. 위험 migration 패턴과 사람 승인

- 질문: 옛 app과 새 app이 함께 도는 배포에서 열 삭제·이름 변경을 확장 뒤 축소 단계로 나누고, data가 있는 table에 기본값 없는 필수 열을 더하지 않으며, 서비스 중에 적용하는 migration이면 쓰기를 막는 index 생성·type 변경에 따른 table 재작성·대량 갱신을 피하거나 나누고, 파괴적 DDL을 사람 승인과 backup 확인 뒤에 실행하는가?
- 기본 severity: `high`
- 적용 조건: migration을 더하거나 바꾸는 변경
- 결함 패턴: 열 삭제·이름 변경을 한 배포에 함(확장 뒤 축소 단계 없음), 기본값 없는 필수 열 추가, 쓰기를 막는 index 생성, type 변경으로 table을 다시 씀, migration 안의 대량 갱신, 사람 승인·backup 확인 없는 파괴적 DDL
- PASS 근거: 옛 app과 새 app이 함께 도는 배포면 열 삭제·이름 변경이 확장과 축소의 다른 배포로 나뉘어 있고, data가 있는 table의 필수 열 추가에는 기본값이나 나눠 채우는 단계가 있으며, 서비스 중에 적용하는 migration이면 index 생성·type 변경·대량 갱신이 쓰기를 막지 않는 생성 방식, 나눈 단계, migration 밖 작업 가운데 하나로 바뀌어 있고, 파괴적 DDL에는 사람 승인 지점과 backup 확인 기록이 있다
- 지침: 옛 app과 새 app이 함께 도는 배포면 먼저 넓히고(새 열·table 추가, 양쪽에 쓰기) 새 app이 자리 잡은 뒤 좁힌다(옛 열 삭제). data가 있는 table에는 필수 열을 기본값과 함께 더하거나 나눠 채운다. 서비스 중에 적용하는 migration은 쓰기를 막지 않는 방식으로 index를 만들고, type 변경과 대량 갱신은 나눈 단계나 migration 밖 작업으로 옮긴다. 열·table 삭제 같은 파괴적 DDL은 agent가 계획·diff까지 만들고 사람이 backup을 확인해 승인한 뒤 실행한다
- 피함: 옛 app과 새 app이 함께 도는 배포에서 열 삭제·이름 변경을 한 번에 하기, data가 있는 table에 기본값 없는 필수 열 더하기, 서비스 중에 table을 오래 잠그는 migration, 사람 승인 없는 파괴적 DDL

### T2. fresh·현재 DB 적용과 되돌림 경로

- 질문: migration을 빈 DB와 data가 있는 현재 DB 양쪽에서 확인하고, 이미 배포된 migration을 고치지 않으며, 잘못됐을 때 돌아갈 경로(forward-fix·되돌리는 migration·restore 가운데 무엇인지)를 정했는가?
- 기본 severity: `medium`
- 적용 조건: migration과 schema 변경
- 결함 패턴: 빈 DB에서만 검사하고 data가 있는 현재 DB 경로를 보지 않음, 이미 배포된 migration을 고침, 되돌림·forward-fix 경로가 없음
- PASS 근거: 빈 DB 적용 test와 현재 schema·대표 data가 있는 DB 적용 test(또는 적용 확인 기록)가 있고, 배포된 migration 파일이 바뀌지 않았으며, 변경 설명에 되돌림 경로가 있다
- 지침: 빈 DB와 현재 DB 양쪽에 적용해 본다. 배포된 migration은 고치지 않고 새 migration으로 고친다. 되돌림 경로를 미리 정하고, 들어온 data를 잃지 않는 forward-fix를 기본으로 하며 backup restore는 마지막 수단으로 둔다
- 피함: 빈 DB에서만 확인하기, 배포된 migration 고치기, 되돌림 경로 없이 배포하기

### T3. seed 멱등·결정적 key·production 안전

- 질문: seed·reference data가 두 번 실행해도 같은 결과이고 실행마다 같은 key를 쓰며, 시험 data가 운영 환경에 들어가지 않고, 실행 owner가 있는가?
- 기본 severity: `medium`
- 적용 조건: seed·reference data와 그 실행 경로
- 결함 패턴: 두 번 실행하면 중복이 생김, 실행마다 key가 달라짐, 운영 환경에 시험 data가 들어갈 수 있음, 실행 owner가 없음
- PASS 근거: seed를 두 번 실행해도 row 수와 key가 같다는 test가 있고, 시험 data를 넣는 seed가 운영 환경에서 실행되지 않는다는 환경 검사와 그 test가 있으며, 실행 owner(언제 누가 실행하는지)가 owner 문서에 있다
- 지침: seed는 결정적 key로 있으면 갱신하고 없으면 넣는 방식으로 만든다. 운영에 필요한 reference data와 시험 data를 나누고, 시험 data는 운영 환경에서 실행되지 않게 막는다. 실행 owner와 실행 시점을 적는다
- 피함: 실행할 때마다 key가 바뀌는 seed, 두 번 실행하면 중복되는 seed, 운영 환경에서도 도는 시험 data
