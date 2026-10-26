// Parser for the pull request body `## Lifecycle` section. Pure: the caller passes the body text.
// The section is every `- <name>: <value>` line from `## Lifecycle` to the next `## ` heading; HTML comments are ignored.
// A body without the section, or a section without a known grade, counts as feature. The `리뷰 PASS`·`원인 PR`·`재채점`
// lines keep their value with the parsed form or null; their checks (review-snapshot-check.mjs) judge the format.

export const LIFECYCLE_GRADES = ['trivial', 'bugfix', 'hotfix', 'feature', 'policy-change'];
// Grades that compute the feature·policy-change fails.
export const POLICY_GRADES = ['feature', 'policy-change'];
const DEFAULT_GRADE = 'feature';

const SECTION_HEADING = /^## Lifecycle\s*$/u;
const NEXT_SECTION = /^## /u;
const FIELD = /^- ([^:]+?):(.*)$/u;
// Separator inside `정책 영향 없음` and `override` values: a dash surrounded by spaces (em dash in the template).
const SEPARATOR = /\s+[—–-]\s+/u;
const CITATION =
  /^\[([a-z0-9-]+)\.md ([A-Z]{2,3}-R[1-9]\d*)\]\(docs\/policies\/([a-z0-9-]+)\.md\)$/u;
const DOMAIN = /^[a-z0-9-]+$/u;
const OWNER_CONFIRMATION = /^(\S+)\s+(\d{4}-\d{2}-\d{2})$/u;
const CHECK_ID = /^[A-Z]+(?:-[A-Z0-9]+)+$/u;
const NONE = '없음';
// `<reviewId> base=<sha> head=<sha> diff=<sha256|none> untracked=<sha256|none>`: commit shas are 40 hex, digests 64 hex
// without the `sha256:` prefix.
const REVIEW_PASS =
  /^(?<reviewId>[A-Za-z0-9][\w.-]*)\s+base=(?<base>[0-9a-f]{40})\s+head=(?<head>[0-9a-f]{40})\s+diff=(?<diff>[0-9a-f]{64}|none)\s+untracked=(?<untracked>[0-9a-f]{64}|none)$/u;
const CAUSE_PR = /^#([1-9]\d*)$/u;
// `<통과|실패> <YYYY-MM-DD> <usage id>`; ids are the held-out usage record ids (`ho-001`).
const RESCORE = /^(?<result>통과|실패)\s+(?<date>\d{4}-\d{2}-\d{2})\s+(?<usageId>ho-\d{3,})$/u;
const UNKNOWN_CAUSE = '모름';
const NOT_APPLICABLE = '해당 없음';

const withoutComments = (text) => text.replace(/<!--[\s\S]*?(?:-->|$)/gu, '');
const list = (value) =>
  value === NONE
    ? []
    : value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

// `<head> — <reason>` with a non-empty reason, else null.
function labelled(value, head) {
  const [label, ...reason] = value.split(SEPARATOR);
  return label === head && reason.join('').trim() ? reason.join(' — ') : null;
}

export function parseReviewPass(value) {
  const match = REVIEW_PASS.exec(value);
  return match ? { ...match.groups } : null;
}

function parseCause(value) {
  const match = CAUSE_PR.exec(value);
  if (match) return { pr: Number(match[1]) };
  const unknown = labelled(value, UNKNOWN_CAUSE);
  return unknown === null ? null : { unknown };
}

function parseRescore(value) {
  const match = RESCORE.exec(value);
  if (match) return { ...match.groups };
  const notApplicable = labelled(value, NOT_APPLICABLE);
  return notApplicable === null ? null : { notApplicable };
}

function sectionFields(body) {
  const lines = withoutComments(body).split(/\r?\n/u);
  const start = lines.findIndex((line) => SECTION_HEADING.test(line));
  if (start < 0) return null;
  const fields = [];
  for (const line of lines.slice(start + 1)) {
    if (NEXT_SECTION.test(line)) break;
    const match = FIELD.exec(line.trim());
    if (match) fields.push({ name: match[1].trim(), value: match[2].trim() });
  }
  return fields;
}

export function parseLifecycleSection(body) {
  const fields = sectionFields(body);
  const section = {
    present: fields !== null,
    fieldNames: [...new Set((fields ?? []).map((field) => field.name))],
    grade: { declared: null, effective: DEFAULT_GRADE },
    gradeBasis: null,
    domains: null,
    citations: [],
    noImpact: [],
    ownerConfirmations: [],
    overrides: [],
    reviewPasses: [],
    causes: [],
    rescores: [],
    warnings: [],
  };
  if (!fields) {
    section.warnings.push('Lifecycle 절 없음: feature로 계산');
    return section;
  }

  const lineWarnings = [];
  for (const { name, value } of fields) {
    if (!value) continue;
    if (name === '변경 등급') section.grade.declared = value;
    else if (name === '등급 근거') section.gradeBasis = value;
    else if (name === '정책 도메인') section.domains = list(value);
    else if (name === '인용 규칙') {
      for (const item of list(value)) {
        const match = CITATION.exec(item);
        if (match && match[1] === match[3])
          section.citations.push({ document: match[1], id: match[2] });
        else lineWarnings.push(`형식이 틀린 인용(인용으로 세지 않음): ${item}`);
      }
    } else if (name === '정책 영향 없음') {
      const [domain, ...reason] = value.split(SEPARATOR);
      if (reason.length && DOMAIN.test(domain))
        section.noImpact.push({ domain, reason: reason.join(' — ') });
      else lineWarnings.push(`형식이 틀린 정책 영향 없음 줄: ${value}`);
    } else if (name === 'Owner 확인') {
      const match = OWNER_CONFIRMATION.exec(value);
      if (match) section.ownerConfirmations.push({ path: match[1], date: match[2] });
      else lineWarnings.push(`형식이 틀린 Owner 확인 줄: ${value}`);
    } else if (name === 'override') {
      const parts = value.split(SEPARATOR);
      if (parts.length >= 3 && CHECK_ID.test(parts[0]))
        section.overrides.push({
          check: parts[0],
          reason: parts.slice(1, -1).join(' — '),
          revisit: parts.at(-1),
        });
      else lineWarnings.push(`형식이 틀린 override 줄: ${value}`);
    } else if (name === '리뷰 PASS')
      section.reviewPasses.push({ value, snapshot: parseReviewPass(value) });
    else if (name === '원인 PR') section.causes.push({ value, cause: parseCause(value) });
    else if (name === '재채점') section.rescores.push({ value, rescore: parseRescore(value) });
  }

  const { declared } = section.grade;
  if (LIFECYCLE_GRADES.includes(declared)) section.grade.effective = declared;
  else
    section.warnings.push(
      declared === null
        ? '변경 등급 없음: feature로 계산'
        : `모르는 변경 등급 '${declared}': feature로 계산`,
    );
  if (!section.gradeBasis) section.warnings.push('등급 근거 없음');
  section.warnings.push(...lineWarnings);
  return section;
}

// Issue numbers the body references (`#123`), outside HTML comments.
export function referencedIssues(body) {
  const numbers = [...withoutComments(body).matchAll(/(?<![\w&#/])#(\d+)\b/gu)].map((match) =>
    Number(match[1]),
  );
  return [...new Set(numbers)].sort((left, right) => left - right);
}
