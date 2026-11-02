import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

// The pages nginx serves without the Web: they must render with the Web down, so each is one file that asks the
// browser for nothing else. infra/deploy/README.md ("정적 안내 화면") owns the rules; the wording is checked by a
// person against local nginx screenshots, so this test does not copy it.
const htmlDir = resolve(import.meta.dirname, '../../../infra/deploy/user/ingress/html');
const pages = {
  'coming-soon.html': { links: ['/'] },
  'maintenance.html': { links: [] },
  'unavailable.html': { links: [''] },
  'not-found.html': { links: ['/'] },
};
const maxBytes = 32 * 1024;

const read = (name) => readFileSync(resolve(htmlDir, name), 'utf8');
const styleOf = (html) =>
  [...html.matchAll(/<style>([\s\S]*?)<\/style>/gu)].map((match) => match[1]);
const linksOf = (html) =>
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gu)].map((match) => match[1]);
const visibleText = (html) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/gu, ' ')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

// Everything that would make the browser fetch something besides the page: stylesheet, script, frame and media
// tags, CSS imports and web fonts, fetching attributes and CSS url() that are not inline images, and any absolute or
// scheme-relative address. An <a href> is navigation, not a fetch, so it is judged by the link rule instead.
function externalReferences(html) {
  const found = [];
  for (const tag of html.matchAll(
    /<(link|script|iframe|object|embed|video|audio|source|track|base)\b/giu,
  )) {
    found.push(`<${tag[1].toLowerCase()}>`);
  }
  for (const rule of html.matchAll(/@(import|font-face)\b/giu))
    found.push(`@${rule[1].toLowerCase()}`);
  for (const attr of html.matchAll(
    /<(\w+)\b[^>]*?\s(src|srcset|poster|data|action|formaction|background|xlink:href|href)="([^"]*)"/giu,
  )) {
    const [, element, name, value] = attr;
    if (name.toLowerCase() === 'href' && element.toLowerCase() === 'a') continue;
    if (!value.startsWith('data:image/') && !value.startsWith('#'))
      found.push(`${name}="${value.slice(0, 40)}"`);
  }
  for (const url of html.matchAll(/url\(\s*['"]?([^'")]*)/giu)) {
    if (!url[1].startsWith('data:image/') && !url[1].startsWith('#'))
      found.push(`url(${url[1].slice(0, 40)})`);
  }
  for (const address of html.matchAll(/(?:https?:)?\/\/[\w.-]+\.[a-z]{2,}/giu))
    found.push(address[0]);
  return found;
}

test('the external reference check finds each kind of fetch and passes a self-contained page', () => {
  const fetching = [
    '<link rel="stylesheet" href="/x.css">',
    '<script src="/x.js"></script>',
    '<style>@import "x.css";</style>',
    '<style>@font-face { font-family: X; }</style>',
    '<img src="/logo.png" alt="">',
    '<img src="https://cdn.example.com/a.png" alt="">',
    '<svg><image href="/x.svg"></image></svg>',
    '<div style="background: url(/bg.png)"></div>',
    '<iframe></iframe>',
    '<p>//cdn.example.com</p>',
  ];
  for (const sample of fetching) {
    assert.notDeepEqual(externalReferences(sample), [], sample);
  }
  const selfContained =
    '<style>.a { background: url(data:image/png;base64,AA==) }</style>' +
    '<img src="data:image/png;base64,AA==" alt=""><svg><use href="#m"></use></svg>' +
    '<a href="/">home</a><a href="">again</a>';
  assert.deepEqual(externalReferences(selfContained), []);
});

for (const [name, expected] of Object.entries(pages)) {
  test(`${name} is one self-contained, unindexed Korean page`, () => {
    assert.ok(
      statSync(resolve(htmlDir, name)).size <= maxBytes,
      `${name} exceeds ${maxBytes} bytes`,
    );
    const html = read(name);
    assert.match(html, /^<!doctype html>/iu);
    assert.match(html, /<html lang="ko">/u);
    assert.match(html, /<meta charset="utf-8"/iu);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/u);
    assert.match(html, /<meta name="robots" content="noindex"/u);
    assert.match(html, /<title>돔두리 — [^<]+<\/title>/u);
    assert.equal(styleOf(html).length, 1, 'one <style> block');
    assert.equal([...html.matchAll(/<h1>/gu)].length, 1, 'one heading');
    assert.match(html, /<img\b[^>]*\bsrc="data:image\/png;base64,[^"]+"[^>]*\balt=""/u);
    assert.match(html, /<svg\b[^>]*\brole="img"[^>]*\baria-label="돔두리"/u);
    assert.deepEqual(externalReferences(html), []);
  });

  test(`${name} links only where its screen needs to`, () => {
    assert.deepEqual(linksOf(read(name)), expected.links);
  });

  test(`${name} shows no status codes or server words`, () => {
    assert.doesNotMatch(visibleText(read(name)), /\b(?:5\d\d|404)\b|nginx|upstream|단계/iu);
  });
}

test('the four pages share one design', () => {
  const [first, ...rest] = Object.keys(pages).map((name) => styleOf(read(name))[0]);
  for (const style of rest) assert.equal(style, first);
});

test('the coming-soon page says sign-up and login open soon', () => {
  const text = visibleText(read('coming-soon.html'));
  assert.match(text, /가입/u);
  assert.match(text, /로그인/u);
});
