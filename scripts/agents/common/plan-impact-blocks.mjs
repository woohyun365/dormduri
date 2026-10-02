// Block map for plan impact inventories. A block is the unit a plan revision reviews:
// code = one top-level statement with its leading comments, Markdown = the smallest heading section,
// JSON = one child of the root array or object, any other file = the whole file.
// The code map is dependency-free. A small lexer separates strings, template literals, regular
// expressions and comments, so prettier's column-0 statement starts can be read from the line layout.
// JSX text is not JavaScript, so `.jsx`/`.tsx` files stay one block (wider, never narrower, than the parser).

const CODE_FILE = /\.(?:[cm]?js|[cm]?ts)$/u;
const KEYWORDS_BEFORE_EXPRESSION = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'yield',
  'await',
  'instanceof',
  '=>',
]);

export function splitLines(text) {
  return text.split(/\r?\n/u);
}

// Returns [startLine, endLine] pairs (1-based, inclusive) for the file at `path` with contents `text`.
export function blockMap(path, text) {
  const lines = splitLines(text);
  if (CODE_FILE.test(path)) return codeBlocks(lines);
  if (path.endsWith('.md')) return markdownBlocks(lines);
  if (path.endsWith('.json')) return jsonBlocks(lines);
  return [[1, lines.length]];
}

function regexMayStartAfter(token) {
  return (
    token === '' ||
    /^[=(,;:!&|?{}[+\-*%<>~^]$/u.test(token) ||
    KEYWORDS_BEFORE_EXPRESSION.has(token)
  );
}

// Per line: lexer state at the line start and whether the line holds anything but comments and blanks.
function lexLines(lines) {
  const records = [];
  const templates = []; // one frame per open template literal; exprDepth is set while inside `${ }`
  let mode = 'code'; // code | comment | string | template
  let quote = '';
  let depth = 0;
  let previous = '';
  lines.forEach((line, index) => {
    const record = { mode, depth, hasCode: false, shebang: index === 0 && line.startsWith('#!') };
    records.push(record);
    if (record.shebang) return;
    let i = 0;
    while (i < line.length) {
      const char = line[i];
      if (mode === 'comment') {
        const end = line.indexOf('*/', i);
        if (end < 0) break;
        i = end + 2;
        mode = 'code';
        continue;
      }
      if (mode === 'string') {
        record.hasCode = true;
        if (char === '\\') i += 2;
        else {
          if (char === quote) {
            mode = 'code';
            previous = 'literal';
          }
          i += 1;
        }
        continue;
      }
      if (mode === 'template') {
        record.hasCode = true;
        if (char === '\\') {
          i += 2;
        } else if (char === '`') {
          templates.pop();
          mode = 'code';
          previous = 'literal';
          i += 1;
        } else if (char === '$' && line[i + 1] === '{') {
          templates.at(-1).exprDepth = depth;
          depth += 1;
          mode = 'code';
          previous = '{';
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }
      if (char === ' ' || char === '\t') {
        i += 1;
        continue;
      }
      if (char === '/' && line[i + 1] === '/') break;
      if (char === '/' && line[i + 1] === '*') {
        mode = 'comment';
        i += 2;
        continue;
      }
      record.hasCode = true;
      if (char === '"' || char === "'") {
        mode = 'string';
        quote = char;
        i += 1;
      } else if (char === '`') {
        templates.push({ exprDepth: null });
        mode = 'template';
        i += 1;
      } else if (char === '/' && regexMayStartAfter(previous)) {
        i = skipRegex(line, i);
        previous = 'literal';
      } else if (char === '{' || char === '(' || char === '[') {
        depth += 1;
        previous = char;
        i += 1;
      } else if (char === '}' || char === ')' || char === ']') {
        depth -= 1;
        const frame = templates.at(-1);
        if (char === '}' && frame && frame.exprDepth === depth) {
          frame.exprDepth = null;
          mode = 'template';
        } else {
          previous = char;
        }
        i += 1;
      } else if (char === '=' && line[i + 1] === '>') {
        previous = '=>';
        i += 2;
      } else {
        const word = /^(?:[A-Za-z_$][\w$]*|\d[\w.]*)/u.exec(line.slice(i));
        previous = word ? word[0] : char;
        i += word ? word[0].length : 1;
      }
    }
  });
  return records;
}

function skipRegex(line, start) {
  let i = start + 1;
  let inClass = false;
  while (i < line.length) {
    const char = line[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) break;
    i += 1;
  }
  i += 1;
  while (i < line.length && /[a-z]/iu.test(line[i])) i += 1;
  return i;
}

// A top-level statement starts at column 0 outside strings, templates and comments, at bracket depth 0.
// It ends on its last line with code; the next block starts on the line after, so leading comments and
// blank lines belong to the following statement. Comments after the last statement belong to no block.
function codeBlocks(lines) {
  const records = lexLines(lines);
  const starts = [];
  let decorating = false;
  records.forEach((record, index) => {
    const line = lines[index];
    if (record.shebang || record.mode !== 'code' || record.depth !== 0 || !record.hasCode) return;
    // Closing brackets, generic closers and a class body's own-line `{` continue the previous statement.
    if (/^[\s{}\])>]/u.test(line) || /^\/[/*]/u.test(line)) return;
    // Decorators at column 0 belong to the declaration that follows them.
    if (decorating) {
      decorating = line.startsWith('@');
      return;
    }
    decorating = line.startsWith('@');
    starts.push(index);
  });
  const ends = starts.map((start, k) => {
    let end = (starts[k + 1] ?? lines.length) - 1;
    while (end > start && !records[end].hasCode) end -= 1;
    return end;
  });
  return starts.map((start, k) => [k === 0 ? 1 : ends[k - 1] + 2, ends[k] + 1]);
}

// 1-based heading lines. `#` lines inside fenced code (``` or ~~~) are code, not headings.
export function markdownHeadingLines(lines) {
  const headings = [];
  let fence = null;
  lines.forEach((line, index) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (fence) {
      // A closing fence uses the opening character, is at least as long and has nothing after it.
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      ) {
        fence = null;
      }
    } else if (marker) fence = marker[1];
    else if (/^#{1,6} /u.test(line)) headings.push(index + 1);
  });
  return headings;
}

function markdownBlocks(lines) {
  const headings = markdownHeadingLines(lines);
  const starts = headings[0] === 1 ? headings : [1, ...headings];
  return starts.map((start, k) => [start, (starts[k + 1] ?? lines.length + 1) - 1]);
}

function jsonBlocks(lines) {
  const blocks = [];
  let depth = 0;
  let start = null;
  lines.forEach((line, index) => {
    const before = depth;
    for (const char of line.replace(/"(?:\\.|[^"\\])*"/gu, '""')) {
      if (char === '{' || char === '[') depth += 1;
      if (char === '}' || char === ']') depth -= 1;
    }
    if (start === null && before === 1 && line.trim() && !/^[\]}],?$/u.test(line.trim())) {
      start = index + 1;
    }
    if (start !== null && depth === 1) {
      blocks.push([start, index + 1]);
      start = null;
    }
  });
  return blocks.length ? blocks : [[1, lines.length]];
}
