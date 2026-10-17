// Parser for the pull request body `## Lifecycle` section. Pure: the caller passes the body text.
// The section is every `- <name>: <value>` line from `## Lifecycle` to the next `## ` heading; HTML comments are ignored.
// A body without the section, or a section without a known grade, counts as feature.

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

const withoutComments = (text) => text.replace(/<!--[\s\S]*?(?:-->|$)/gu, '');
const list = (value) =>
  value === NONE
    ? []
    : value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

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
    }
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
