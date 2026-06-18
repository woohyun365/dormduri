# Figma Web Reference

이 디렉터리는 Figma export/reference React source를 Web app package boundary 밖에 보관하는 위치다.

- `src/` 아래의 TS/TSX export source는 재생성 가능한 reference artifact로 보고 git에서 추적하지 않는다.
- 제품 코드로 반영할 때는 필요한 UI 구조와 copy만 `apps/web/src/**`로 옮기고, Web lint/type/build gate는 `apps/web`의 실제 제품 코드만 대상으로 유지한다.
- 이 디렉터리는 문서용 markdown 묶음이 아니라 source-like design reference의 보관 위치다.
