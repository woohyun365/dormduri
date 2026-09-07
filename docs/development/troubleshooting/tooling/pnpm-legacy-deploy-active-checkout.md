# pnpm legacy deploy active checkout 격리와 복구

## 책임

이 문서는 production-only pnpm deploy 결과를 검사할 때 developer checkout의 dependency state를 변경하지 않는 실행 경계와
오실행 복구를 소유한다. API runtime image의 canonical deploy 명령은 `infra/deploy/api/Dockerfile`이 소유한다.

## 증상

다음과 같이 active checkout을 입력으로 production-only deploy를 직접 실행한 뒤 IDE, lint, test 또는 build에서 development
dependency를 찾지 못하거나 workspace module state가 달라질 수 있다.

```bash
pnpm deploy --legacy --filter api --prod <output-directory>
```

`--legacy` 자체가 금지된 것은 아니다. 위험한 조합은 **현재 개발 중인 checkout을 production-only deploy 계산의 입력으로
직접 사용하는 것**이다.

## 원인

`pnpm deploy --prod`는 선택한 package와 production dependency만으로 runtime tree를 materialize한다. legacy deploy가
workspace의 shared module graph를 재사용하는 과정에서 active checkout의 installed dependency state가 production-only
결과에 맞춰 reconcile될 수 있다. 이 상태는 tracked source 변경이 아니더라도 같은 checkout에서 뒤이어 실행하는 개발 검증을
오염시킨다.

Dockerfile에서는 install과 deploy가 disposable build filesystem 안에서 실행되므로 host checkout의 module state와 분리된다.
따라서 canonical Docker build-stage 명령을 제거하거나 `--legacy` 사용 전체를 금지하지 않는다.

## 안전한 실행

우선순위는 다음과 같다.

1. 실제 runtime artifact 검증은 canonical Docker image build를 사용한다.
2. pnpm deploy 자체를 조사해야 하면 disposable Git worktree 또는 tracked source copy를 사용한다.
3. active checkout에서는 `pnpm deploy --prod`와 `pnpm deploy --legacy --prod`를 실행하지 않는다.

```bash
pnpm infra:compose -- api-base build api
```

Disposable worktree를 사용할 때는 현재 작업과 겹치지 않는 임시 경로를 만들고, 검증이 끝난 뒤 해당 worktree만 제거한다.
사용자 소유 untracked 파일과 현재 checkout은 복사·삭제·reset하지 않는다.

## 오실행 복구

1. 같은 workspace에서 진행 중인 pnpm install, build, test를 먼저 중단한다.
2. tracked source와 사용자 소유 파일을 보존한 채 canonical frozen install로 development dependency state를 복구한다.
3. working tree와 가장 가까운 검증을 다시 확인한다.

```bash
CI=true pnpm install --frozen-lockfile
git status --short
pnpm check:fast
```

복구 과정에서 `git reset --hard`, untracked cleanup 또는 lockfile 재생성을 사용하지 않는다. Frozen install이 실패하면 원인을
확인하기 전 다른 pnpm command를 병렬 실행하지 않는다.

## 검증

```bash
node --test scripts/ci/agent-guidance-boundary.test.mjs
pnpm test:repo-policy
pnpm infra:compose -- api-base build api
```

Docker build가 성공하고 host의 tracked working tree가 바뀌지 않아야 한다.
