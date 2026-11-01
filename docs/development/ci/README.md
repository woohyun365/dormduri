# CI development

CI 변경을 만들 때 따르는 현재 기준입니다. Job graph와 설계 결정은
[Monorepo CI architecture](../../architecture/platform/monorepo-ci.md), 재발할 수 있는 CI 장애는
[Troubleshooting](../troubleshooting/README.md)의 CI 행이 소유합니다.

- [CI surface ownership](./ci-surface-ownership.md): 경로 family별 표면·lane·owner, formatting 검사 범위, 새 경로 추가 절차

CI 개선의 측정값과 근거(개선 전후 수치, 대안 비교)는 사람 대상 기록이라 [CI evidence](../../evidence/ci/README.md)에 둡니다.

## Bot이 갱신하는 값

Renovate 같은 bot이나 도구가 갱신하는 값(dependency version, lockfile resolution, action SHA, image tag·digest)은 owner
파일 하나가 갖습니다. Test는 그 값을 복사해 단언하지 않고 형식(full commit SHA, `<tag>@sha256:<digest>`), owner 파일
사이의 일치, 고친 취약 version의 하한과 재등장 금지를 검사합니다. 값을 복사한 단언은 bot PR이 사람 commit 없이 CI를
통과하지 못하게 만듭니다. 다른 파일이 그 값을 써야 하면 owner 파일에서 읽습니다(예: `infra/image-inventory.json`은 owner
파일 경로만 갖고 image reference는 `scripts/infra/artifacts/image-inventory.mjs`가 owner 파일에서 읽습니다).

## Scripts test 정리 기준

`scripts/**` test를 더하거나 고치거나 지울 때 아래 셋을 따릅니다. Test 설계 원칙은
[swe.md S6](../agent-workflows/review-criteria/swe.md#s6-보호-test)·[S12](../agent-workflows/review-criteria/swe.md#s12-동작계약을-고정하는-test)와
[review criteria](../agent-workflows/review-criteria/README.md)의 layer 기준 문서가 소유하고, 이 절은 scripts test에 적용하는
기준만 둡니다.

1. 측정·조사 기록은 evidence 문서와 Git 이력에 두고 fixture로 고정하지 않습니다. Test는 그 값을 다시 적어 단언하지 않습니다.
2. 사건 순서·옛 이름은 단언하지 않습니다. 과거 run·PR의 순서와 닫힌 측정 구간을 test가 고정하지 않습니다. 지운 이름·설계가
   돌아오지 않는다는 test는 S12 조건(보안·신뢰 경계나 되돌리기 어려운 결정, 근거 결정 기록 링크)일 때만 둡니다.
3. Negative test는 보안·신뢰 경계와 fail-closed 동작에 씁니다(예: 형식이 틀리거나 빠진 입력 거부, 다른 출처에서 읽은 값 거부).

적용 예:

- CI 성능 표본은 각 run head의 dependency fingerprint로 묶습니다. 손으로 회전하던 측정 구간 fixture와 그 순서 test는 두지 않습니다.
- 개선 전 CI 기준값과 Dependabot update job 취소 기록은 evidence·troubleshooting 문서와 Git 이력에 두고 fixture로 두지 않습니다.
