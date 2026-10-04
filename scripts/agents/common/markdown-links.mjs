// Markdown prose, heading anchors and relative links. Shared by the document graph test and the plan reference check.

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

// Source text without fenced code blocks (the fence lines themselves are dropped too).
export function prose(source) {
  let fence = null;
  return source
    .split('\n')
    .filter((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
      if (marker) {
        if (!fence) fence = marker[0];
        else if (fence === marker[0]) fence = null;
        return false;
      }
      return !fence;
    })
    .join('\n');
}

// GitHub-style heading anchors (with `-1`, `-2` suffixes for repeats) plus explicit HTML `id`/`name` anchors.
export function anchors(source) {
  const result = new Set(),
    counts = new Map();
  for (const match of prose(source).matchAll(/^#{1,6}\s+(.+)$/gmu)) {
    const base = match[1]
      .trim()
      .toLowerCase()
      .replace(/<[^>]+>/gu, '')
      .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
      .replace(/\s/gu, '-');
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    result.add(base + (count ? `-${count}` : ''));
  }
  for (const match of source.matchAll(/<(?:a|h[1-6])[^>]+(?:id|name)=["']([^"']+)["']/gu))
    result.add(match[1]);
  return result;
}

// A link target with a malformed percent escape stays as written, so it resolves to no file instead of throwing.
export function decodeTarget(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Relative inline and reference-style links of the Markdown file at `path` (relative to `root`), outside code.
// Each target is `{ path, fragment }` with `path` relative to `root`; URLs with a scheme or `//` are skipped.
export function links(root, path, source = readFileSync(resolve(root, path), 'utf8')) {
  const text = prose(source).replace(/`+[^`\n]*`+/gu, '');
  const targets = [...text.matchAll(/(?<!!)\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/gu)].map(
    (m) => m[1],
  );
  for (const match of text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gmu)) targets.push(match[1]);
  return targets
    .filter((target) => !/^(?:[a-z]+:|\/\/)/iu.test(target))
    .map((target) => {
      const [file, fragment] = target.split('#');
      return {
        path: relative(root, resolve(root, dirname(path), decodeTarget(file))),
        fragment: fragment ? decodeTarget(fragment) : null,
      };
    });
}
