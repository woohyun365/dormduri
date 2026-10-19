// Area criteria check (W-AREA) of the Lifecycle gate. Every product path the PR changes needs a review criteria area: the
// review criteria selection module judges each path against the head catalog (binding path keys and pack sublayer
// sections), and a path without an area only warns through a row of the exemption table in the PR base's binding
// document. Findings use the policy-first shape; run.mjs applies override lines and the bot·main downgrade. Authoring
// rules: docs/development/github/collaboration.md (`Lifecycle` 절); exemption table: the binding document's `영역 검사`.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  bindingPathGlobs,
  loadReviewCriteriaCatalog,
  matchPathGlob,
  matchReviewCriteriaPath,
  REVIEW_BINDING_PATH,
  REVIEW_CRITERIA_DIR,
  REVIEW_PACK_DIR,
} from '../../agents/common/review-criteria-selection.mjs';
import { POLICY_GRADES } from './lifecycle-section.mjs';
import { LifecycleInputError } from './policy-first-check.mjs';

export const AREA_CHECK_ID = 'W-AREA';
const SECTION_HEADING = /^## 영역 검사\s*$/u;
const NEXT_SECTION = /^## /u;
const TABLE_HEADER = '제외 경로|이유';
const SEPARATOR_ROW = /^\|(?:\s*:?-{3,}:?\s*\|)+$/u;
// Selection module errors start with a code (`criteria-document-missing: …`).
const CATALOG_ERROR = /^[a-z]+(?:-[a-z]+)+: /u;

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/gu, '')
    .split(/(?<!\\)\|/u)
    .map((cell) => cell.trim());

const matchesGlobs = (path, { include, exclude }) =>
  include.some((glob) => matchPathGlob(path, glob)) &&
  !exclude.some((glob) => matchPathGlob(path, glob));

// The `| 제외 경로 | 이유 |` table of the `## 영역 검사` section: each row's backtick globs (read like a binding value, `!`
// excludes) and reason. null without the text or the section; a section without the table and a row without a glob or a
// reason are refused.
export function parseExemptionTable(text, where) {
  if (text === null) return null;
  const lines = text.split(/\r?\n/u);
  const start = lines.findIndex((line) => SECTION_HEADING.test(line));
  if (start < 0) return null;
  const fail = (detail) => {
    throw new LifecycleInputError(`${where} 영역 검사 표 형식 오류: ${detail}`);
  };
  const end = lines.findIndex((line, index) => index > start && NEXT_SECTION.test(line));
  const section = lines.slice(start + 1, end < 0 ? undefined : end).map((line) => line.trim());
  const header = section.findIndex(
    (line) => line.startsWith('|') && cells(line).join('|') === TABLE_HEADER,
  );
  if (header < 0) fail('`| 제외 경로 | 이유 |` 표 없음');
  if (!SEPARATOR_ROW.test(section[header + 1] ?? '')) fail('표 구분 행 없음');

  const rows = [];
  for (const line of section.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    const [globs = '', reason = '', ...rest] = cells(line);
    if (rest.length) fail(`칸이 둘이 아닌 행: ${line}`);
    const { include, exclude } = bindingPathGlobs(globs);
    if (!include.length) fail(`glob 없는 행: ${line}`);
    if (!reason) fail(`이유 없는 행: ${line}`);
    rows.push({ include, exclude, reason });
  }
  return rows;
}

const catalogFile = (path) =>
  path === REVIEW_BINDING_PATH ||
  [REVIEW_CRITERIA_DIR, REVIEW_PACK_DIR].some(
    (dir) =>
      path.startsWith(`${dir}/`) &&
      !path.slice(dir.length + 1).includes('/') &&
      path.endsWith('.md'),
  );

// The head revision's catalog. The selection module reads a directory and the gate's checkout is not the head (a
// pull_request checkout is the merge ref), so the head's binding document and the Markdown files right under the pack
// and criteria directories are copied into a temporary root first.
export function loadHeadCatalog(context) {
  const root = mkdtempSync(join(tmpdir(), 'knu-area-catalog-'));
  try {
    for (const path of context.headFiles.filter(catalogFile)) {
      const text = context.readFile(context.revisions.head, path);
      if (text === null) continue;
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return loadReviewCriteriaCatalog(root);
  } catch (error) {
    if (error instanceof TypeError && CATALOG_ERROR.test(error.message))
      throw new LifecycleInputError(`리뷰 기준 catalog 오류: ${error.message}`);
    throw error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// Binding path keys that match the path but that no criteria document uses (an area without criteria).
function keysWithoutCriteria(path, catalog) {
  const used = new Set(Object.values(catalog.documents).flatMap((document) => document.keys));
  return Object.entries(catalog.keys)
    .filter(([key, globs]) => !used.has(key) && matchesGlobs(path, globs))
    .map(([key]) => key)
    .sort();
}

export function evaluateAreaCriteria(context, { loadCatalog = loadHeadCatalog } = {}) {
  const { grade, revisions } = context;
  const findings = [];
  const add = (level, reason) => findings.push({ check: AREA_CHECK_ID, level, reason });

  // Without a product path the catalog and both tables stay unread.
  const productPaths = [...new Set(context.changedPaths.filter(context.isProductPath))].sort();
  if (!productPaths.length) {
    add('pass', '제품 경로 없음');
    return findings;
  }

  const catalog = loadCatalog(context);
  const exemptions = (revision, label) =>
    parseExemptionTable(
      context.readFile(revision, REVIEW_BINDING_PATH),
      `${label} ${REVIEW_BINDING_PATH}`,
    );
  // The base table judges, so a row the PR adds does not exempt the PR's own paths. A branch older than a base that
  // dropped a row also has that row only at head; taking the base brings the area key that replaced it.
  const base = exemptions(revisions.base, 'base') ?? [];
  const head = exemptions(revisions.head, 'head');
  const groundLevel = POLICY_GRADES.includes(grade) ? 'fail' : 'warn';

  const areas = new Set();
  let covered = 0;
  const uncovered = [];
  for (const path of productPaths) {
    const judged = matchReviewCriteriaPath(path, catalog).areas;
    if (judged.length) {
      covered += 1;
      for (const area of judged) areas.add(area);
      continue;
    }
    const row = base.find((candidate) => matchesGlobs(path, candidate));
    if (row) {
      uncovered.push(['warn', `제외 경로: ${path} — ${row.reason}`]);
      continue;
    }
    const keys = keysWithoutCriteria(path, catalog);
    let reason = `영역 기준 없는 제품 경로: ${path}(${keys.length ? `맞은 키 ${keys.join(', ')}에 pack 절 없음` : '영역 키 없음'})`;
    if ((head ?? []).some((candidate) => matchesGlobs(path, candidate)))
      reason +=
        ' — head 제외 표에만 있는 행은 적용하지 않음(이 PR이 더했거나 분기 뒤 base에서 지운 행)';
    if (groundLevel === 'warn') reason += ` — ${grade}는 경고`;
    uncovered.push([groundLevel, reason]);
  }
  if (covered) add('pass', `제품 경로 ${covered}개, 영역 ${[...areas].sort().join(', ')}`);
  for (const [level, reason] of uncovered) add(level, reason);

  // Table hygiene at head: a glob that matches no tracked file, and a glob that also covers a tracked path with an area.
  for (const row of head ?? [])
    for (const glob of row.include) {
      const matched = context.headFiles.filter((path) =>
        matchesGlobs(path, { include: [glob], exclude: row.exclude }),
      );
      if (!matched.length) {
        add('warn', `추적 파일에 맞지 않는 제외 glob: ${glob}`);
        continue;
      }
      const withArea = matched
        .map((path) => [path, matchReviewCriteriaPath(path, catalog).areas])
        .filter(([, pathAreas]) => pathAreas.length);
      if (withArea.length)
        add(
          'warn',
          `영역 있는 경로를 덮는 제외 glob: ${glob}(${withArea.length}개, 예: ${withArea[0][0]} 영역 ${withArea[0][1].join(', ')})`,
        );
    }
  return findings;
}
