# Web DB index and query criteria

[Review criteria](./README.md)의 `web-db-index-query` 기준입니다. DB 조회 pattern과 index, raw SQL을 더하거나 바꾸는 변경에
적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-trust-authz-model.md P4](./web-security-privacy-trust-authz-model.md#p4-주입xssopen-redirect)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 T1 → [swe.md S8](./swe.md#s8-측정-근거-있는-성능), T2 →
[swe.md S3](./swe.md#s3-정확성과-오류-경로)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### T1. query shape과 index·실행 계획 확인

- 질문: 새 조회 pattern의 자주 쓰는 조건에 맞는 index가 있고, 쓰는 query가 없는 index를 더하지 않으며, 핵심 query를 바꾸면 실행 계획을 확인하는가?
- 기본 severity: `medium`
- 적용 조건: 새 조회 pattern·index를 더하거나 바꾸는 변경
- 결함 패턴: 자주 쓰는 조건에 index가 없음, 쓰지 않는 index가 쌓임, 핵심 query의 실행 계획을 확인하지 않음
- PASS 근거: 새 조회 조건마다 맞는 index나 index가 필요 없는 이유(작은 table 등)가 있고, 새 index마다 쓰는 query가 있으며, 핵심 query를 바꾼 변경에는 대표 data에서 확인한 실행 계획 기록이 있다
- 지침: 조회 pattern(조건·정렬·상한)을 먼저 적고 그에 맞는 index를 둔다. index는 쓰는 query가 있을 때만 더한다. 핵심 query를 바꾸면 대표 data로 실행 계획을 확인해 남긴다
- 피함: 자주 쓰는 조건에 맞는 index 없이 조회 더하기, 쓰는 query가 없는 index, 문제가 생긴 뒤에야 실행 계획 보기

### T2. raw SQL 위치와 parameter binding

- 질문: raw SQL이 owner가 정한 위치에 모여 있고, 값을 parameter binding으로 넘기며, 결과 type을 검증하는가?
- 기본 severity: `high`
- 적용 조건: raw SQL을 더하거나 바꾸는 변경
- 결함 패턴: 문자열 연결로 SQL을 만듦, raw SQL이 owner 밖 여러 곳에 흩어짐, 결과 type을 검증하지 않음
- PASS 근거: raw SQL이 정해진 위치(SQL 파일 묶음이나 owner의 repository 한 곳)에 있고, 모든 값이 parameter binding으로 들어가며, 결과를 type이나 schema로 검증하는 code와 그 test가 있다
- 지침: raw SQL은 ORM 같은 query builder로 표현하기 어려운 query에 쓰고 정해진 위치에 둔다. 값은 parameter binding으로 넘기고, 식별자(table·열 이름)를 입력으로 받아야 하면 허용 목록에서 고른다. 결과는 type이나 schema로 검증한다
- 피함: 문자열 연결로 SQL 만들기, 여러 곳에 흩어진 raw SQL, 검증 없이 결과 쓰기
