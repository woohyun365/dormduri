// Document status header of the lifecycle state machine: consecutive `**key**: value` lines right under the first `# `
// title, after any blank lines. The state reads only this header and the tracking record. Pure: the caller passes the
// text. Field rules: docs/development/agent-workflows/lifecycle-state-machine.md (문서 상태 header).

export const HEADER_STATUSES = ['draft', 'owner-confirmed', 'superseded'];
const OWNER_CONFIRMED = 'owner-confirmed';

const TITLE = '# ';
const KEY_LINE = /^\*\*([^*]+)\*\*:/u;
// The value of a key line. A key line with an empty value stays in the header but gives no value.
const KEY_VALUE = /^\*\*([^*]+)\*\*:\s*(.+)$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const LINK_TARGET = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/gu;

// → { status, confirmedOn, confirmationRef, basis, keys } or null without key lines. Values are the first non-empty
// value of each key as written; `basis` is the Markdown link targets of the `근거` line; `keys` lists every key line.
export function parseDocumentHeader(text) {
  const lines = text.split('\n');
  let index = lines.findIndex((line) => line.startsWith(TITLE));
  if (index < 0) return null;
  for (index += 1; index < lines.length && !lines[index].trim(); index += 1);
  const keys = [];
  const values = new Map();
  for (; index < lines.length; index += 1) {
    const key = KEY_LINE.exec(lines[index])?.[1];
    if (key === undefined) break;
    keys.push(key);
    const value = KEY_VALUE.exec(lines[index])?.[2].trim();
    if (value !== undefined && !values.has(key)) values.set(key, value);
  }
  if (!keys.length) return null;
  return {
    status: values.get('상태') ?? null,
    confirmedOn: values.get('확인일') ?? null,
    confirmationRef: values.get('확인 근거') ?? null,
    basis: [...(values.get('근거') ?? '').matchAll(LINK_TARGET)].map((match) => match[1]),
    keys,
  };
}

// → [{ code, message }]. `requireBasis` is false only for the PRD overview, which has no upstream artifact. Whether
// `확인 근거` names a PR and matches the PR body Owner line is a CI row, not this check.
export function checkDocumentHeader(text, { requireBasis = true } = {}) {
  const header = parseDocumentHeader(text);
  if (!header) return [{ code: 'header-missing', message: '제목 아래 header 줄이 없음' }];
  const findings = [];
  const add = (code, message) => findings.push({ code, message });
  if (!HEADER_STATUSES.includes(header.status))
    add(
      'header-status-invalid',
      `상태가 ${HEADER_STATUSES.join('·')} 밖: ${header.status ?? '상태 줄 없음'}`,
    );
  if (header.status === OWNER_CONFIRMED) {
    const missing = [
      ...(DATE.test(header.confirmedOn ?? '') ? [] : ['확인일(YYYY-MM-DD)']),
      ...(header.confirmationRef ? [] : ['확인 근거']),
    ];
    if (missing.length)
      add('header-confirmed-fields-missing', `owner-confirmed인데 없음: ${missing.join(', ')}`);
  }
  if (requireBasis && !header.basis.length)
    add('header-basis-missing', '근거 줄에 상위 산출물 링크가 없음');
  return findings;
}
