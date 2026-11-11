// CD workflow 글을 job·step·경로 filter 단위로 읽는 test helper(web-cd-contract.test.mjs·api-cd-contract.test.mjs 공용).
// YAML parser를 쓰지 않고 이 저장소 workflow의 들여쓰기 규칙(job 2칸, job 속성 4칸, step 6칸, step 속성 8칸)에 기댄다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `jobs:` 아래 두 칸 들여쓴 이름마다 그 job의 글.
export function jobs(source) {
  const body = source.slice(source.indexOf('\njobs:\n') + 7);
  const parts = body.split(/^ {2}(?=[a-z][a-z0-9_-]*:$)/mu).filter(Boolean);
  return Object.fromEntries(parts.map((part) => [part.slice(0, part.indexOf(':')), part]));
}

// job 글 → 이름 있는 step 목록(순서 유지).
export function steps(job) {
  return job
    .split(/^ {6}- name: /mu)
    .slice(1)
    .map((part) => ({ name: part.slice(0, part.indexOf('\n')), body: part }));
}

export function permissions(job) {
  const block = /^ {4}permissions:\n((?: {6}[a-z-]+: [a-z]+\n)+)/mu.exec(job)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/^ {6}([a-z-]+): ([a-z]+)$/gmu)].map((m) => [m[1], m[2]]),
  );
}

export const stepIndex = (list, pattern) => list.findIndex((step) => pattern.test(step.body));

// step 글의 `run: |` block을 들여쓰기 없이 꺼낸다.
export function runScript(body) {
  const lines = body.slice(body.indexOf('run: |\n') + 'run: |\n'.length).split('\n');
  const indent = /^ */u.exec(lines[0])[0].length;
  return lines
    .filter((line) => line.trim() === '' || line.length - line.trimStart().length >= indent)
    .map((line) => line.slice(indent))
    .join('\n');
}

// push trigger의 `paths` 목록(따옴표를 뗀 값). 목록 안에 주석 줄을 두지 않는다.
export function pushPaths(source) {
  const block = /^ {4}paths:\n((?: {6}- .+\n)+)/mu.exec(source)[1];
  return [...block.matchAll(/^ {6}- (\S+)$/gmu)].map((match) =>
    match[1].replace(/^'(.*)'$/u, '$1'),
  );
}

const matches = (path, filter) =>
  filter.endsWith('/**') ? `${path}/`.startsWith(filter.slice(0, -2)) : filter === path;

// GitHub `paths`: 마지막으로 맞은 pattern이 정한다(`!`는 제외).
export const triggers = (path, filters) =>
  filters.reduce((result, filter) => {
    if (filter.startsWith('!')) return matches(path, filter.slice(1)) ? false : result;
    return matches(path, filter) ? true : result;
  }, false);

// Dockerfile의 COPY 원본 → 저장소 경로(build context 기준). 다른 stage에서 복사(`--from`)는 뺀다.
export function copySources(repoRoot, dockerfile, context) {
  const text = readFileSync(resolve(repoRoot, dockerfile), 'utf8');
  return [...text.matchAll(/^COPY (?!--from)(.+)$/gmu)].flatMap((match) => {
    const parts = match[1].split(/\s+/u).filter((part) => !part.startsWith('--'));
    return parts.slice(0, -1).map((source) => (context ? `${context}/${source}` : source));
  });
}

// 배포 입력 stale check script의 `<NAME>=(...)` 경로 목록을 workflow `paths` 형식으로 되돌린다.
export function stalePaths(script, name) {
  const list = new RegExp(`^${name}=\\(\\n([\\s\\S]+?)\\n\\)$`, 'mu').exec(script);
  if (!list) throw new Error(`${name}=(...) path list not found`);
  return list[1]
    .split(/\s+/u)
    .filter(Boolean)
    .map((path) => path.replace(/^'(.*)'$/u, '$1'));
}
