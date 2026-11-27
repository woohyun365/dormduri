# Web infra repository structure criteria

[Review criteria](./README.md)의 `web-infra-repository-structure` 기준입니다. 저장소·배포 단위 app·service를 나누거나 합치는
변경, 배포 단위 app의 기능 code 위치와 workspace package·library 구성과 그 사이 의존 규칙, test 파일의 층별 위치와 test 설정의
수집 범위·e2e project 구성을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 I1 →
[swe.md S5](./swe.md#s5-계약-호환성), I2 → [swe.md S4](./swe.md#s4-책임-경계와-결합도)·[swe.md S11](./swe.md#s11-응집도와-중복-trade-off), I3 →
[swe.md S6](./swe.md#s6-보호-test)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### I1. 배포 단위·저장소 나눔 근거와 경계 계약

- 질문: 저장소·배포 단위 app·service를 새로 나누거나 합칠 때 팀 경계·독립 배포·독립 확장 요구의 현재 증거와 전환 trigger를 근거로 삼고, 나뉜 단위 사이 경계를 소비자 쪽 test가 만든 계약을 제공자가 자기 build에서 검증하는 test로 지키며, 배포 전에 함께 도는 다른 단위 version과 호환되는지 확인하는가?
- 기본 severity: `medium`
- 적용 조건: 저장소·배포 단위 app·service를 더하거나 나누거나 합치는 변경
- 결함 패턴: 현재 증거와 전환 trigger 없이 저장소·배포 단위·service를 나눔, 나뉜 단위 사이 경계 계약 test가 없거나 한쪽 build에서만 돎, 배포 전 다른 단위 version과의 호환 확인이 없음
- PASS 근거: 변경 설명이나 결정 기록에 나눈 근거(팀 경계·배포 속도·확장 요구의 측정이나 기록)와 전환 trigger가 있고, 경계마다 소비자 test가 만든 계약을 제공자 build가 검증하는 test와 그 실행 기록이 있으며, 배포 단계에 함께 도는 다른 단위 version과의 호환 확인이 있다
- 지침: 저장소와 배포 단위는 팀 경계마다 권한·배포 속도가 따로 필요하거나 단위별 독립 확장이 측정한 요구가 될 때 나눈다. 나눈 경계에는 소비자 test가 계약을 만들고 제공자가 자기 build에서 검증하는 test를 두고, 배포 전에 그 환경의 다른 단위 version과 호환을 확인한다. 여러 단위를 잇는 e2e는 끝까지 봐야 뜻이 있는 핵심 흐름만 적게 두고 pipeline의 따로 도는 단계로 나눈다
- 피함: 앞으로의 규모를 위해 증거 없이 저장소·service 나누기, 경계 계약 test 없이 나뉜 단위끼리 호출하기, 여러 단위 e2e로 경계 계약을 대신하기

### I2. 배포 shell과 domain library 경계

- 질문: 기능 code가 저장소가 고른 code 단위(결정 기록)를 따르고, 배포 shell과 domain library로 나눈 저장소에서는 app에 진입점·설정·route·조립만 두며, library가 다른 domain library의 내부가 아니라 공개 entry만 가져다 쓰고, 한 domain만 쓰는 code를 공유 library로 올리지 않으며, library 사이 의존 방향을 결정적 검사가 막는가?
- 기본 severity: `medium`
- 적용 조건: 배포 단위 app의 기능 code 위치, workspace package·library 구성과 그 사이 의존 규칙을 더하거나 바꾸는 변경
- 결함 패턴: 고른 code 단위를 어기고 기능 code를 app shell이나 다른 domain에 둠, 다른 domain library의 내부 파일을 직접 가져다 씀, 한 domain만 쓰는 code를 공유 library로 올림, 늘 함께 바뀌는 code를 여러 library로 쪼갬, 더하거나 바꾼 library 사이 의존 규칙이 문서에만 있고 검사가 없음
- PASS 근거: 바뀐 기능 code가 결정 기록이 고른 단위에 있고, library 사이 import가 공개 entry로만 가며, 공유 library의 code마다 그것을 쓰는 domain이 둘 이상이고, 더하거나 바꾼 library 사이에서 금지한 의존이 실패하는 lint나 project graph 검사 결과가 있다
- 지침: 결정 기록이 고른 code 단위를 따른다. library로 나눈 저장소는 app에 진입점·설정·route·조립만 두고 기능은 domain마다 종류(화면·use case, 상태 없는 표현, API client·저장소, 순수 함수·type)별 library로 둔다. 둘째 domain이 쓸 때 공유 library로 올리고 늘 함께 바뀌는 code는 나누지 않는다. library 사이 의존 방향은 project tag 같은 결정적 규칙으로 막는다. 아직 옮기지 않은 영역은 그 영역을 다시 만들 때 옮기고 그동안 섞인 상태를 owner 문서에 적는다
- 피함: 다시 만든 영역의 기능 code를 app shell에 두기, 다른 domain library의 내부 파일 가져다 쓰기, 둘째 domain 없이 공유 library 만들기, 의존 규칙을 문서로만 두기

### I3. test 층 배치와 project 소속

- 질문: 새로 두거나 옮긴 test가 저장소가 고른 test 배치(결정 기록·binding 고른 값)의 층별 위치에 있어 경로로 어느 app·library의 어느 층 test인지 알 수 있고, 그 층의 test 설정 수집 범위와 바뀐 부분을 고르는 검사가 그 test를 고르는가?
- 기본 severity: `low`
- 적용 조건: test 파일을 더하거나 옮기는 변경, test 설정의 수집 범위나 e2e project 구성을 바꾸는 변경
- 결함 패턴: test를 고른 층 위치와 다른 곳에 둠, 경로로 소속 app·library를 알 수 없는 test, 여러 app을 잇는 흐름을 app 하나의 e2e에 둠, 수집 범위 밖이라 돌지 않는 test(그 test가 지키던 동작의 보호가 사라져 [swe.md S6](./swe.md#s6-보호-test)에도 맞음), 한 층 test가 다른 층의 실행 묶음에 섞임
- PASS 근거: 바뀐 test 경로가 고른 배치의 층 위치와 같고, 그 test가 속한 층의 test 설정 수집 범위에 들며, 바뀐 부분만 고르는 검사를 쓰면 그 검사가 그 test를 고른다는 실행 기록이 있다
- 지침: 저장소가 고른 test 배치를 따른다. 층별 가까운 위치를 고른 저장소는 unit·component test를 source 옆에, DB·외부 의존 integration을 그 app·library의 test 디렉터리에, app 하나의 e2e를 그 app 안에, 여러 app·DB를 잇는 흐름을 최상위 e2e project에 둔다. test를 옮기면 test 설정의 수집 범위를 함께 고치고 옮기기 전후 test·case 수를 맞춘다
- 피함: 경로로 소속을 알 수 없는 test 모음, 수집 범위 밖에 둔 test, 여러 app 흐름을 한 app e2e에 넣기
