# Local image artifact contract

`pnpm infra:artifacts:build -- --allow-dirty`는 API와 Web image를 별도 BuildKit builder로
OCI layout에 빌드하고 `artifacts/local/build/`에 다음 secret-free evidence를 남긴다.

`KNU_ARTIFACTS_DIR` 또는 `--output`을 지정하면 기본 로컬 경로를 대체할 수 있다. 공통
산출물 경계와 삭제 정책은 루트 `artifacts/README.md`를 따른다.

- `artifact-manifest.json`: source commit, dirty 여부, OCI digest, non-root runtime user, evidence 경로
- `api|web.build-metadata.json`: BuildKit build metadata
- `api|web.sbom.spdx.json`: OCI attestation에서 추출한 SPDX JSON
- `api|web.provenance.slsa.json`: OCI attestation에서 추출한 SLSA provenance

기본 실행은 working tree가 깨끗해야 한다. `--allow-dirty`는 개발 리허설에서만 쓰며 manifest에
`workingTreeDirty: true`가 명시된다. 이 local manifest는 registry push나 GitHub attestation을
대체하지 않는다. 미래 release owner는 같은 schema를 remote digest와 persisted attestation으로
확장한다.

검증만 다시 수행하려면 다음 command를 사용한다.

```bash
pnpm infra:artifacts:verify
```

manifest와 SBOM에는 token, cookie, DB URL, Sentry auth token 등 secret 값을 기록하지 않는다.
Build secret은 Docker `--secret` mount로만 전달하고 build arg로 전달하지 않는다.
