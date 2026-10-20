# Web DB integrity, retention, and lifecycle criteria

[Review criteria](./README.md)의 `web-db-integrity-retention-lifecycle` 기준입니다. DB 수준 무결성과 잠금, 보존 기한이 지난 data의
삭제·익명화 작업, DB 역할·grant·접속 계정을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-data-privacy-secret.md P3](./web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 T1 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), T2 →
[swe.md S2](./swe.md#s2-제품-정책-부합), T3 → [swe.md S4](./swe.md#s4-책임-경계와-결합도)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### T1. DB 제약·lock helper·lock 순서

- 질문: DB 제약으로 막을 수 있는 경쟁을 DB가 마지막에 막는 방식(unique·check 제약, 조건부 갱신, version 열)으로 막고, 잠금이 필요하면 공용 lock helper를 정해진 순서로 쓰는가?
- 기본 severity: `medium`
- 적용 조건: DB 수준 무결성·잠금을 쓰는 변경
- 결함 패턴: 같은 자원을 경로마다 다른 순서로 잠금, 공용 lock helper를 우회한 직접 잠금, DB 제약으로 막을 수 있는 경쟁을 application 검사로만 막음
- PASS 근거: DB 제약으로 막을 수 있는 경쟁마다 제약·조건부 갱신·version 열 가운데 하나와 그 위반 test가 있고, 잠금은 공용 helper를 거치며 잠금 순서가 helper나 owner 문서 한 곳에 정해져 있다
- 지침: 경쟁은 DB가 마지막에 막게 한다(unique·check 제약, 조건부 갱신, version 열). 여러 row를 함께 판정해 잠금이 필요하면 공용 lock helper를 정해진 순서로 쓴다
- 피함: DB 제약으로 막을 수 있는 경쟁을 application 검사로만 막기, helper를 우회한 직접 잠금, 경로마다 다른 잠금 순서

### T2. 보존 기한 삭제·비식별 실행

- 질문: 보존 기한이 지난 data를 지우거나 익명화하는 작업이 관련 table을 모두 처리하고, 익명화 뒤 남은 열로 다시 식별되지 않으며, 실행 기록이 남고 다시 실행해도 안전한가?
- 기본 severity: `high`
- 적용 조건: 보존 기한이 지난 data의 삭제·익명화 작업을 더하거나 바꾸는 변경
- 결함 패턴: 삭제 작업이 관련 table 일부를 남김, 익명화 뒤 다른 열로 다시 식별됨, 삭제 실행 기록과 재실행 안전성이 없음
- PASS 근거: 삭제·익명화 대상 table 목록이 정책 원본의 보존 항목과 맞고, 실행 뒤 관련 table에 원래 값이 없거나 비식별됐다는 확인과 같은 작업을 다시 실행해도 결과가 같다는 확인(test나 실행 기록)이 있으며, 실행마다 대상 수와 결과가 기록된다
- 지침: 삭제·익명화는 관련 table과 사본을 함께 다루고, 익명화 뒤 남은 열 조합으로 다시 식별되지 않는지 확인한다. 작업은 다시 실행해도 같은 결과가 나오게 만들고 실행 기록을 남긴다. 실행 방식(주기 작업·수동 운영)과 상관없이 기한에 실행한다
- 피함: 관련 table 일부만 지우기, 다시 식별되는 익명화, 실행 기록 없는 삭제, 두 번 실행하면 깨지는 삭제 작업

### T3. DB 계정 분리와 최소 grant

- 질문: app 실행 계정이 schema 변경 권한 없이 쓰는 권한만 갖고 migration은 따로 된 계정으로 실행하며, agent·개발 환경에 운영 쓰기 자격 증명이 없어 운영 DB의 grant·data 변경을 사람이 승인해 실행하는가?
- 기본 severity: `high`
- 적용 조건: DB 역할·grant·접속 계정을 바꾸는 변경
- 결함 패턴: app이 schema 변경 권한 계정으로 접속함, 쓰지 않는 권한을 grant함, agent·개발 환경에 운영 쓰기 자격 증명이 있음
- PASS 근거: 계정별 grant 정의가 저장소에 있고, app 계정에 schema 변경 권한과 쓰지 않는 권한이 없다는 grant 확인(smoke test나 정의 대조)이 있으며, 운영 쓰기 자격 증명이 agent·개발 환경 설정에 없어 운영 DB의 grant·data 변경이 자격 증명을 가진 사람의 승인 뒤에 실행된다
- 지침: app 실행 계정과 migration 계정을 나누고, app 계정에는 쓰는 table에 필요한 권한만 준다. 운영 쓰기 자격 증명은 agent·개발 환경에 두지 않고, 운영 DB의 grant·data를 바꾸는 작업은 agent가 계획·diff까지 만들고 자격 증명을 가진 사람이 승인해 실행한다
- 피함: app이 schema 변경 권한 계정으로 접속하기, 쓰지 않는 권한 주기, agent·개발 환경에 운영 쓰기 자격 증명 두기
