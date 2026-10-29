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
