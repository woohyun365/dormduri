# Web operations-release SLO and signal criteria

[Review criteria](./README.md)의 `web-operations-release-slo-signal` 기준입니다. health·readiness 신호와 종료 처리, 운영
신호·alert·runbook, 의존 서비스 실패 때의 동작과 성능·가용성 목표를 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 O1 →
[swe.md S3](./swe.md#s3-정확성과-오류-경로), O2 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), O3 →
[swe.md S8](./swe.md#s8-측정-근거-있는-성능)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다. 이 문서의 항목을 상속하는 영역 문서는 그 문서 머리말에 적습니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### O1. health·readiness 신호 범위

- 질문: health 진입점이 살아 있음(liveness)과 요청을 받을 준비(readiness)를 나눠 알리고, 내부 상세를 드러내지 않으며, 종료 신호를 받으면 진행 중 요청을 정리하는가?
- 기본 severity: `medium`
- 적용 조건: health·readiness 진입점과 그 응답, 종료 처리를 더하거나 바꾸는 변경
- 결함 패턴: liveness와 readiness를 구분하지 않음, health 응답이 내부 상세(version·연결 문자열·오류 원문)를 드러냄, 의존 서비스의 일시 장애로 모든 instance가 재시작되게 함, 종료 신호에서 진행 중 요청을 정리하지 않음
- PASS 근거: liveness는 process 자신만 보고 readiness는 요청 처리에 필요한 의존 상태를 본다는 test가 있고, 밖에 보이는 health 응답에 내부 상세가 없으며, 종료 신호 뒤 새 요청을 받지 않고 진행 중 요청을 마친다는 test나 확인 기록이 있다
- 지침: liveness는 process가 스스로 회복할 수 없는 상태만 보고, readiness는 요청을 받을 준비(의존 연결 포함)를 본다. 밖에 보이는 응답은 상태만 알린다. 종료 신호를 받으면 readiness를 내리고 진행 중 요청을 마친 뒤 끝낸다
- 피함: liveness 확인에 의존 서비스 확인 넣기, health 응답에 내부 상세 담기, 종료 신호에 진행 중 요청을 바로 끊기

### O2. 운영 신호·alert·runbook 연결

- 질문: 더하는 metric·log·alert가 운영 질문과 대응 행동에 연결되고, 구조화된 log와 상관 id를 쓰며, alert마다 runbook·owner가 있는가?
- 기본 severity: `medium`
- 적용 조건: metric·log·alert·dashboard·runbook을 더하거나 바꾸는 변경
- 결함 패턴: 운영 질문과 연결되지 않은 metric을 늘림, 제품 분석 data와 운영 신호를 섞음, 대응 행동이 없는 alert, 구조화되지 않은 log·상관 id 없음, alert에 runbook·owner가 없음
- PASS 근거: 새 신호마다 답하는 운영 질문이 변경 설명에 있고, log가 구조화된 형식과 상관 id를 가지며, alert 규칙마다 runbook 링크와 owner가 있다
- 지침: 신호는 운영 질문(정상인가, 어디가 포화인가, 무엇을 할까)에서 시작하고 제품 분석 data와 나눠 둔다. log는 구조화된 형식과 요청 상관 id로 남기고, alert는 대응 행동과 runbook·owner를 함께 둔다
- 피함: 질문 없는 metric 늘리기, 대응 행동 없는 alert, 구조 없는 문자열 log만 남기기

### O3. 실패 동작과 성능·가용성 budget

- 질문: 의존 서비스가 실패할 때의 동작(fail-open·fail-closed·저하)을 정하고, 성능·가용성을 주장하면 목표와 측정·대조가 함께 있는가?
- 기본 severity: `low`
- 적용 조건: timeout·retry·저하 동작이나 성능·가용성 목표를 정하거나 바꾸는 변경
- 결함 패턴: 의존 서비스 실패 때의 동작(fail-open·fail-closed·저하)을 정하지 않음, 목표 없이 성능·가용성을 주장함, budget을 정하고 측정·대조하지 않음
- PASS 근거: 의존 서비스마다 실패 때의 동작이 정해져 있고 그 동작을 보는 test가 있으며, 성능·가용성 주장에는 목표와 측정 결과의 대조가 있다
- 지침: 의존 서비스마다 timeout과 실패 때의 동작(열어 둠·닫음·저하)을 정한다. 성능·가용성을 주장하거나 목표를 두면 측정 방법과 결과를 함께 두고 목표와 대조한다. 목표 값은 정책·운영 원본이 소유한다
- 피함: 실패 동작을 정하지 않기, 측정 없는 성능·가용성 주장, 대조하지 않는 budget
