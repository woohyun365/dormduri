// Review ledger: validates host reader rows and counts reviewer runs (status, verdict, severity, criteria item, round,
// Parent adjudication, disposition, origin). It knows no host paths; a host reader such as
// scripts/agents/claude/review-ledger-source.mjs reads its own records and passes rows in.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Row: { host, taskId, issuedAt, subjectKey, round, status, verdict,
//        findings: [{ id, severity, criteriaItem }], adjudication: { status, dispositions, origins } }
// A ledger is a measurement, not a verdict: malformed rows are rejected with a reason and left out of every count.

export const ROW_STATUSES = ['parsed', 'parse-failed', 'completion-missing', 'task-unreadable'];
export const ADJUDICATION_STATUSES = ['recorded', 'invalid', 'missing'];

const isText = (value) => typeof value === 'string' && value.length > 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function rowProblem(row) {
  if (!isObject(row)) return 'row must be an object';
  if (!isText(row.host)) return 'host must be a non-empty string';
  if (!isText(row.taskId)) return 'taskId must be a non-empty string';
  if (row.issuedAt !== null && !isText(row.issuedAt)) return 'issuedAt must be a string or null';
  if (row.subjectKey !== null && !isText(row.subjectKey))
    return 'subjectKey must be a string or null';
  if (row.round !== null && !(Number.isInteger(row.round) && row.round >= 1))
    return 'round must be a positive integer or null';
  if (!ROW_STATUSES.includes(row.status)) return `status must be one of ${ROW_STATUSES.join(', ')}`;
  if (row.status === 'parsed' ? !isText(row.verdict) : row.verdict !== null)
    return 'verdict must be a string exactly when status is parsed';
  if (!Array.isArray(row.findings)) return 'findings must be an array';
  for (const finding of row.findings) {
    if (!isObject(finding) || !isText(finding.id) || !isText(finding.severity))
      return 'each finding needs a non-empty id and severity';
    if (finding.criteriaItem !== null && !isText(finding.criteriaItem))
      return 'criteriaItem must be a string or null';
  }
  const { adjudication } = row;
  if (
    !isObject(adjudication) ||
    !ADJUDICATION_STATUSES.includes(adjudication.status) ||
    !Array.isArray(adjudication.dispositions) ||
    !Array.isArray(adjudication.origins)
  )
    return 'adjudication needs a status and dispositions and origins arrays';
  return null;
}

function count(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

export function buildLedger(rows) {
  const accepted = [];
  const rejected = [];
  rows.forEach((row, index) => {
    const reason = rowProblem(row);
    if (reason)
      rejected.push({ index, taskId: isObject(row) ? (row.taskId ?? null) : null, reason });
    else accepted.push(row);
  });
  const summary = {
    count: accepted.length,
    subjects: new Set(accepted.map((row) => row.subjectKey).filter(Boolean)).size,
    statuses: {},
    verdicts: {},
    severity: {},
    criteriaItems: {},
    zeroFindingRuns: 0,
    findingsMedian: null,
    findingsMean: null,
    rounds: {},
    adjudication: {},
    dispositions: {},
    origins: {},
  };
  const findingCounts = [];
  for (const row of accepted) {
    count(summary.statuses, row.status);
    count(summary.rounds, row.round ?? 'unknown');
    count(summary.adjudication, row.adjudication.status);
    for (const disposition of row.adjudication.dispositions)
      count(summary.dispositions, disposition);
    for (const origin of row.adjudication.origins) count(summary.origins, origin);
    if (row.status !== 'parsed') continue;
    count(summary.verdicts, row.verdict);
    findingCounts.push(row.findings.length);
    for (const finding of row.findings) {
      count(summary.severity, finding.severity);
      if (finding.criteriaItem) count(summary.criteriaItems, finding.criteriaItem);
    }
  }
  // Same statistics as the first hand-made ledger: the median is the upper middle value of the sorted counts.
  findingCounts.sort((left, right) => left - right);
  if (findingCounts.length) {
    summary.zeroFindingRuns = findingCounts.filter((value) => value === 0).length;
    summary.findingsMedian = findingCounts[Math.floor(findingCounts.length / 2)];
    summary.findingsMean = Number(
      (findingCounts.reduce((sum, value) => sum + value, 0) / findingCounts.length).toFixed(2),
    );
  }
  return { rows: accepted, summary, rejected };
}
