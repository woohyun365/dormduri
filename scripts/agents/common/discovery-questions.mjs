// Discovery question space: reads a domain pack (README layer table and layer documents) from the working tree and lists
// each sublayer's decisions with the pack rule's irreversible flag and the order of decisions to settle first.
// Rules: docs/development/agent-workflows/plan-authoring/discovery.md. Decision record bodies are never parsed.
//
// Usage: node scripts/agents/common/discovery-questions.mjs [--pack <dir>] [--sublayer <id>]... [--skeleton]
// Without --sublayer every sublayer is listed. JSON goes to stdout; --skeleton prints decision record entries as
// Markdown instead. Nothing is written to files. Exit 0 = output, 1 = malformed pack, unknown sublayer or bad option.

import { readdirSync, readFileSync } from 'node:fs';
import { posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { anchors, prose } from './markdown-links.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const DEFAULT_PACK = 'docs/development/agent-workflows/domain/swe-web';
// Decision records live in one file per pack layer document (plan-authoring/discovery.md).
const DECISION_DIR = 'docs/architecture/decisions';
const FIELDS = new Map([
  ['수준', 'level'],
  ['질문', 'question'],
  ['선택지', 'options'],
  ['먼저 정할 결정', 'dependsOn'],
  ['되돌림', 'reversal'],
  ['기본값', 'default'],
  ['확인 단서', 'confirmationCue'],
  ['기준 항목', 'criteria'],
]);
const REVERSALS = new Set(['easy', 'costly', 'one-way']);
const RECORD_FIELDS = ['판정', '상태', '고른 선택지', '근거', '기각한 대안', '재검토 조건', '출처'];
const RISK_LINE = '- 비가역 선택:';

// Every Markdown file directly under the pack directory; the layer table decides which ones are layer documents.
export function readDomainPack(directory) {
  const names = readdirSync(directory).filter((name) => name.endsWith('.md'));
  return {
    path: relative(ROOT, directory).split(sep).join('/'),
    documents: Object.fromEntries(
      names.sort().map((name) => [name, readFileSync(resolve(directory, name), 'utf8')]),
    ),
  };
}

export function analyzeDomainPack(pack, { sublayers: selection } = {}) {
  const sublayers = parsePack(pack);
  const decisions = new Map();
  for (const decision of sublayers.flatMap((sublayer) => sublayer.decisions)) {
    if (decisions.has(decision.id)) fail(`duplicate decision ${decision.id}`);
    decisions.set(decision.id, decision);
  }
  for (const decision of decisions.values())
    for (const dependency of decision.dependsOn)
      if (!decisions.has(dependency)) fail(`${decision.id}: unknown decision ${dependency}`);

  // Pack rule: one-way, or costly while another decision names it as a decision to settle first.
  const dependedOn = new Set([...decisions.values()].flatMap(({ dependsOn }) => dependsOn));
  for (const decision of decisions.values())
    decision.irreversible =
      decision.reversal === 'one-way' ||
      (decision.reversal === 'costly' && dependedOn.has(decision.id));
  for (const sublayer of sublayers)
    for (const id of sublayer.irreversibleListed)
      if (!decisions.has(id)) fail(`${sublayer.id}: unknown decision ${id} in 비가역 선택`);

  const order = dependencyOrder(decisions);
  const chosen = selectSublayers(sublayers, selection);
  const selected = new Set(chosen.flatMap((sublayer) => sublayer.decisions.map(({ id }) => id)));
  const outside = new Set(
    [...selected].flatMap((id) => decisions.get(id).dependsOn).filter((id) => !selected.has(id)),
  );
  return {
    schemaVersion: 1,
    pack: pack.path,
    sublayers: chosen,
    order: order.filter((id) => selected.has(id)),
    outsidePrerequisites: order.filter((id) => outside.has(id)),
  };
}

// Decision record entries (plan-authoring/discovery.md) grouped by layer file; values are left for the work to fill.
export function renderDecisionSkeleton(result) {
  const files = new Map();
  for (const sublayer of result.sublayers)
    files.set(sublayer.decisionFile, [...(files.get(sublayer.decisionFile) ?? []), sublayer]);
  const lines = [];
  for (const [file, sublayers] of files) {
    const irreversible = sublayers.flatMap(({ decisions }) =>
      decisions.filter((decision) => decision.irreversible).map(({ id }) => id),
    );
    lines.push(
      `<!-- ${file}${irreversible.length ? ` · 비가역: ${irreversible.join(', ')}` : ''} -->`,
      '',
    );
    for (const sublayer of sublayers) {
      const target = posix.relative(DECISION_DIR, `${result.pack}/${sublayer.document}`);
      lines.push(`## ${sublayer.name}`, '');
      for (const { id } of sublayer.decisions) {
        const [anchor] = anchors(`#### ${id}`);
        lines.push(
          `#### ${id}`,
          '',
          ...RECORD_FIELDS.map((field) => `- ${field}:`),
          `- pack 결정: [${id}](${target}#${anchor})`,
          '',
        );
      }
    }
  }
  return lines.join('\n');
}

function parsePack({ documents }) {
  const readme = documents['README.md'];
  if (readme === undefined) fail('README.md: missing');
  return layerTable(readme).flatMap((row) => {
    const text = documents[row.document];
    if (text === undefined) fail(`layer table: ${row.document} is missing`);
    const sublayers = parseLayerDocument(row, text);
    const names = sublayers.map(({ name }) => name);
    if (names.join(',') !== row.sublayers.join(','))
      fail(
        `layer table: ${row.document} lists ${row.sublayers.join(', ')} but has ${names.join(', ')}`,
      );
    return sublayers;
  });
}

// Rows of the README layer table: layer name, a link to the layer document, and the backticked sublayer names.
function layerTable(readme) {
  const rows = [];
  for (const line of prose(readme).split('\n')) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const document = /^\[[^\]]+\]\(\.\/([^)#/]+\.md)\)$/u.exec(cells[1] ?? '')?.[1];
    if (cells.length !== 3 || !document) continue;
    rows.push({
      layer: cells[0],
      document,
      sublayers: [...cells[2].matchAll(/`([^`]+)`/gu)].map((match) => match[1]),
    });
  }
  if (!rows.length) fail('README.md: no layer table rows');
  return rows;
}

function parseLayerDocument(row, text) {
  const sublayers = [];
  let sublayer = null;
  let section = null;
  let decision = null;
  let field = null;
  for (const line of prose(text).split('\n')) {
    const heading = /^(#{2,4}) (.+)$/u.exec(line);
    if (heading?.[1] === '##') {
      sublayer = {
        id: null,
        name: heading[2].trim(),
        layer: row.layer,
        document: row.document,
        decisionFile: `${DECISION_DIR}/${row.document}`,
        decisions: [],
        irreversibleListed: null,
        risk: false,
      };
      sublayers.push(sublayer);
      section = decision = field = null;
      continue;
    }
    if (!sublayer) continue;
    if (heading?.[1] === '###') {
      section = heading[2].trim();
      if (section === '위험') sublayer.risk = true;
      decision = field = null;
      continue;
    }
    if (heading?.[1] === '####') {
      if (section !== '결정 목록') continue;
      decision = { id: heading[2].trim(), fields: {} };
      sublayer.decisions.push(decision);
      field = null;
      continue;
    }
    const id = /^`([^`]+)`$/u.exec(line)?.[1];
    if (sublayer.id === null && section === null && id) {
      sublayer.id = id;
      continue;
    }
    if (section === '위험' && line.startsWith(RISK_LINE)) {
      sublayer.irreversibleListed = riskList(sublayer, line.slice(RISK_LINE.length).trim());
      continue;
    }
    if (!decision) continue;
    const entry = /^- ([^:]+):\s*(.*)$/u.exec(line);
    if (entry && FIELDS.has(entry[1])) {
      field = entry[1];
      decision.fields[field] = field === '선택지' ? [] : entry[2].trim();
    } else if (/^\s+- /u.test(line) && field === '선택지') {
      decision.fields[field].push(line.replace(/^\s+- /u, '').trim());
    } else if (entry) {
      field = null;
    }
  }
  return sublayers.map((current) => finishSublayer(row, current));
}

function finishSublayer(row, { risk, ...sublayer }) {
  const where = sublayer.id ?? `${row.document} ## ${sublayer.name}`;
  if (!sublayer.id?.endsWith(`/${sublayer.name}`)) fail(`${where}: missing sublayer id line`);
  if (!sublayer.decisions.length) fail(`${where}: no decisions`);
  if (!risk) fail(`${where}: missing ### 위험`);
  if (sublayer.irreversibleListed === null) fail(`${where}: missing 비가역 선택 line`);
  return { ...sublayer, decisions: sublayer.decisions.map(finishDecision) };
}

function finishDecision({ id, fields }) {
  for (const name of FIELDS.keys())
    if (!(name in fields) || (Array.isArray(fields[name]) && !fields[name].length))
      fail(`${id}: missing field ${name}`);
  const reversal = /^`([^`]+)`(.*)$/u.exec(fields['되돌림']);
  if (!reversal || !REVERSALS.has(reversal[1]))
    fail(`${id}: reversal must be easy, costly or one-way`);
  const first = fields['먼저 정할 결정'];
  const dependsOn = [...first.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
  if (first !== '없음' && !dependsOn.length) fail(`${id}: malformed 먼저 정할 결정`);
  return {
    id,
    level: /^`([^`]+)`$/u.exec(fields['수준'])?.[1] ?? fields['수준'],
    question: fields['질문'],
    options: fields['선택지'],
    dependsOn,
    reversal: reversal[1],
    reversalNote: reversal[2].replace(/^[.,:]?\s*/u, ''),
    default: fields['기본값'],
    confirmationCue: fields['확인 단서'],
    criteria: fields['기준 항목'],
    irreversible: false,
  };
}

// `없음` (optionally followed by a note) or backticked ids each followed by their reversal in parentheses.
function riskList(sublayer, text) {
  if (text.startsWith('없음')) return [];
  const ids = [...text.matchAll(/`([a-z0-9][a-z0-9.-]*)`\(`(?:one-way|costly)`/gu)].map(
    (match) => match[1],
  );
  if (!ids.length) fail(`${sublayer.id ?? sublayer.name}: malformed 비가역 선택 line`);
  return ids;
}

// Decisions to settle first come first; ties keep document order.
function dependencyOrder(decisions) {
  const order = [];
  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'active') fail(`dependency cycle at ${id}`);
    state.set(id, 'active');
    for (const dependency of decisions.get(id).dependsOn) visit(dependency);
    state.set(id, 'done');
    order.push(id);
  };
  for (const id of decisions.keys()) visit(id);
  return order;
}

function selectSublayers(sublayers, selection) {
  if (selection === undefined) return sublayers;
  const known = new Set(sublayers.map(({ id }) => id));
  for (const id of selection) if (!known.has(id)) fail(`unknown sublayer ${id}`);
  return sublayers.filter(({ id }) => selection.includes(id));
}

function fail(message) {
  throw new Error(message);
}

function main(args) {
  const { values } = parseArgs({
    args,
    options: {
      pack: { type: 'string', default: DEFAULT_PACK },
      sublayer: { type: 'string', multiple: true },
      skeleton: { type: 'boolean', default: false },
    },
  });
  const result = analyzeDomainPack(readDomainPack(resolve(values.pack)), {
    sublayers: values.sublayer,
  });
  process.stdout.write(
    values.skeleton ? renderDecisionSkeleton(result) : `${JSON.stringify(result, null, 2)}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
