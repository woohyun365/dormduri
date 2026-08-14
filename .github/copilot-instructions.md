# KNU Roommate collaboration adapter

- 한국어를 기본으로 응답합니다.
- 현재 사용자 요청과 current working tree의 production code, contract, test를 가장 먼저 신뢰합니다.
- 작업 전에 root `AGENTS.md`와 요청에 필요한 최소 tracked owner guide만 확인합니다.
- 사용자 소유 변경이나 요청 범위 밖 파일을 수정·삭제·stage하지 않습니다.
- 기존 owner pattern, utility, component를 먼저 재사용하고 명시적 요청 없이 dependency를 추가하지 않습니다.
- 변경 동작에 가장 가까운 targeted test를 먼저 실행하고 영향 범위에 맞는 상위 검증을 추가합니다.
- local memory와 historical document는 현재 구현의 source of truth로 취급하지 않습니다.
