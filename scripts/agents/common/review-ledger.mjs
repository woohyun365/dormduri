// Review ledger: validates host reader rows and counts reviewer runs (host, status, verdict, severity, criteria item,
// round, Parent adjudication, disposition, origin) and subjects (size, rounds, origins, trailing non-PASS, snapshots).
// It knows no host paths; a host reader (scripts/agents/claude/review-ledger-source.mjs,
// scripts/agents/codex/review-ledger-source.mjs) reads its own records and passes rows in.
// Rules and usage: docs/development/agent-workflows/review-criteria/README.md
//
// Row: { host, taskId, issuedAt, subjectKey, round, status, verdict,
//        findings: [{ id, severity, criteriaItem, location }], adjudication: { status, dispositions, origins },
//        subjectSize?, snapshot? }
// A finding's location is the result finding's `location` (string), or null when the result gave none.
// Optional fields a reader fills when it knows them: subjectSize { paths, documents } (subject paths and criteria
// documents of that review, from its criteria record) and snapshot (the digest of the snapshot it reviewed).
// A ledger is a measurement, not a verdict: malformed rows are rejected with a reason and left out of every count.

export const ROW_STATUSES = ['parsed', 'parse-failed', 'completion-missing', 'task-unreadable'];
export const ADJUDICATION_STATUSES = ['recorded', 'invalid', 'missing'];

const isText = (value) => typeof value === 'string' && value.length > 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value) => Number.isInteger(value) && value >= 0;

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
    if (finding.location !== null && !isText(finding.location))
      return 'location must be a string or null';
  }
  const { adjudication } = row;
  if (
    !isObject(adjudication) ||
    !ADJUDICATION_STATUSES.includes(adjudication.status) ||
    !Array.isArray(adjudication.dispositions) ||
    !Array.isArray(adjudication.origins)
  )
    return 'adjudication needs a status and dispositions and origins arrays';
  const { subjectSize } = row;
  if (
    subjectSize !== undefined &&
    subjectSize !== null &&
    !(isObject(subjectSize) && isCount(subjectSize.paths) && isCount(subjectSize.documents))
  )
    return 'subjectSize must be null or { paths, documents } of non-negative integers';
  if (row.snapshot !== undefined && row.snapshot !== null && !isText(row.snapshot))
    return 'snapshot must be a non-empty string or null';
  return null;
}

function count(map, key, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

// One row per subject: its size (from its first round, since later rounds read a delta), runs, distinct known rounds,
// origins, the non-PASS rounds at its end (a round passes when every row of it is a parsed PASS) and distinct
// snapshots. Rows without a subject key or round stay out of the subject and round counts they cannot place.
function subjectRows(rows) {
  const bySubject = new Map();
  for (const row of rows)
    if (row.subjectKey !== null)
      bySubject.set(row.subjectKey, [...(bySubject.get(row.subjectKey) ?? []), row]);
  return [...bySubject.keys()].sort().map((subjectKey) => {
    const subject = bySubject.get(subjectKey);
    const sized = subject
      .filter((row) => row.subjectSize)
      .sort((left, right) => (left.round ?? Infinity) - (right.round ?? Infinity))[0];
    const rounds = new Map();
    for (const row of subject)
      if (row.round !== null)
        rounds.set(
          row.round,
          (rounds.get(row.round) ?? true) && row.status === 'parsed' && row.verdict === 'PASS',
        );
    let trailingNonPass = 0;
    for (const round of [...rounds.keys()].sort((left, right) => right - left)) {
      if (rounds.get(round)) break;
      trailingNonPass += 1;
    }
    const origins = {};
    for (const row of subject)
      for (const origin of row.adjudication.origins) count(origins, origin);
    return {
      subjectKey,
      paths: sized ? sized.subjectSize.paths : null,
      documents: sized ? sized.subjectSize.documents : null,
      runs: subject.length,
      rounds: rounds.size,
      origins,
      trailingNonPass,
      snapshots: new Set(subject.map((row) => row.snapshot ?? null).filter(Boolean)).size,
    };
  });
}

// Runs, rounds and origins by subject size (#730): the subjects of one size, from their per-subject rows.
function subjectSizes(rows) {
  const sizes = {};
  for (const row of rows) {
    const key = row.paths === null ? 'unknown' : `paths:${row.paths},documents:${row.documents}`;
    sizes[key] ??= { subjects: 0, runs: 0, rounds: 0, origins: {} };
    sizes[key].subjects += 1;
    sizes[key].runs += row.runs;
    sizes[key].rounds += row.rounds;
    for (const [origin, value] of Object.entries(row.origins))
      count(sizes[key].origins, origin, value);
  }
  return sizes;
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
    hosts: {},
    subjectSizes: {},
    subjectRows: [],
  };
  const findingCounts = [];
  for (const row of accepted) {
    count(summary.hosts, row.host);
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
  summary.subjectRows = subjectRows(accepted);
  summary.subjectSizes = subjectSizes(summary.subjectRows);
  return { rows: accepted, summary, rejected };
}
