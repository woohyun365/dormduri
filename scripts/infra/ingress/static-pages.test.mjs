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
  [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)].map((match) => match[1]);
const visibleText = (html) =>
  html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

// Start tags with their attributes, whatever the quotes; a quoted value may hold `>`.
const startTags = (html) =>
  [...html.matchAll(/<([a-z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/giu)].map((match) => ({
    element: match[1].toLowerCase(),
    attributes: [
      ...match[2].matchAll(/([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu),
    ].map((attr) => ({
      name: attr[1].toLowerCase(),
      value: attr[2] ?? attr[3] ?? attr[4] ?? '',
    })),
  }));
const linksOf = (html) =>
  startTags(html)
    .filter((tag) => tag.element === 'a')
    .map((tag) => tag.attributes.find((attr) => attr.name === 'href')?.value);

// The pages may use only what is listed here, and nothing listed asks the browser for anything: no script, no other
// file, no at-rule, no fetching attribute or CSS function. The one image is an inline PNG in <img src>; an <a href> is navigation,
// judged by the link rule. To use another element, attribute or CSS function, first check that it fetches nothing,
// then add it here.
const allowedElements = new Set([
  ...['html', 'head', 'meta', 'title', 'style', 'body', 'main', 'div', 'h1', 'p', 'br', 'a', 'img'],
  ...['svg', 'g', 'path', 'circle'],
]);
const allowedAttributes = new Set([
  ...['lang', 'charset', 'name', 'content', 'class', 'href', 'src', 'alt', 'width', 'height'],
  ...['role', 'aria-label', 'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap'],
  ...['stroke-linejoin', 'transform', 'd', 'cx', 'cy', 'r'],
]);
const allowedCssFunctions = new Set([
  ...['rgb', 'rgba', 'radial-gradient', 'linear-gradient', 'calc', 'min', 'max', 'clamp', 'var'],
]);
const inlinePng = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/u;

function disallowed(html) {
  const found = [];
  for (const { element, attributes } of startTags(html)) {
    if (!allowedElements.has(element)) found.push(`<${element}>`);
    for (const { name, value } of attributes) {
      if (!allowedAttributes.has(name)) found.push(`${element} ${name}`);
      else if (name === 'href' && element !== 'a') found.push(`${element} href`);
      else if (name === 'src' && !(element === 'img' && inlinePng.test(value)))
        found.push(`${element} src="${value.slice(0, 40)}"`);
    }
  }
  for (const css of styleOf(html)) {
    if (css.includes('\\')) found.push('CSS escape');
    for (const rule of css.matchAll(/@[\w-]+/gu)) found.push(rule[0]);
    for (const call of css.matchAll(/([\w-]+)\s*\(/gu)) {
      if (!allowedCssFunctions.has(call[1].toLowerCase())) found.push(`${call[1]}()`);
    }
  }
  for (const url of html.matchAll(/url\s*\(/giu)) found.push(url[0]);
  for (const address of html.matchAll(/(?:https?:)?\/\/[\w.-]+\.[a-z]{2,}/giu))
    found.push(address[0]);
  return found;
}

test('the allowlist check finds each kind of fetch or script and passes a self-contained page', () => {
  const fetching = [
    '<link rel="stylesheet" href="/x.css">',
    '<script src="/x.js"></script>',
    '<style>@import "x.css";</style>',
    '<style>@font-face { font-family: X; }</style>',
    '<style>.a { background-image: image-set("/bg.png" 1x); }</style>',
    '<style>.a { background: u\\72l(/bg.png); }</style>',
    '<img src="/logo.png" alt="">',
    '<img src="#" alt="">',
    '<img src="data:image/svg+xml;base64,AA==" alt="">',
    '<img src="https://cdn.example.com/a.png" alt="">',
    '<img src="data:image/png;base64,AA==" srcset="data:image/png;base64,AA== 1x, /logo-2x.png 2x" alt="">',
    "<img src='/x.png' alt=''>",
    '<img src=/x.png alt="">',
    '<a ping="#a /t" href="/">x</a>',
    '<svg><use href="/sprite.svg#a"></use></svg>',
    '<svg><g fill="url(/p.svg#g)"></g></svg>',
    '<div style="background: red"></div>',
    '<body onload="go()"></body>',
    '<meta http-equiv="refresh" content="0; url=/x">',
    '<iframe></iframe>',
    '<p>//cdn.example.com</p>',
  ];
  for (const sample of fetching) {
    assert.notDeepEqual(disallowed(sample), [], sample);
  }
  const selfContained =
    '<style>.a { background: radial-gradient(rgb(1 2 3 / 20%), transparent) }</style>' +
    '<img src="data:image/png;base64,AA==" alt=""><svg role="img" aria-label="a > b"><g fill="none">' +
    '<path d="M0 0 H1"/></g></svg><a href="/">home</a><a href="">again</a>';
  assert.deepEqual(disallowed(selfContained), []);
});

for (const [name, expected] of Object.entries(pages)) {
  test(`${name} is one self-contained, unindexed Korean page`, () => {
    assert.ok(
      statSync(resolve(htmlDir, name)).size <= maxBytes,
      `${name} exceeds ${maxBytes} bytes`,
    );
    const html = read(name);
    assert.match(html, /^<!doctype html>/iu);
    assert.match(html, /<html\b[^>]*\blang="ko"/u);
    assert.match(html, /<meta charset="utf-8"/iu);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/u);
    assert.match(html, /<meta name="robots" content="noindex"/u);
    assert.match(html, /<title>돔두리 — [^<]+<\/title>/u);
    assert.equal(styleOf(html).length, 1, 'one <style> block');
    assert.equal([...html.matchAll(/<h1\b/giu)].length, 1, 'one heading');
    assert.match(html, /<img\b[^>]*\bsrc="data:image\/png;base64,[^"]+"[^>]*\balt=""/u);
    assert.match(html, /<svg\b[^>]*\brole="img"[^>]*\baria-label="돔두리"/u);
    assert.deepEqual(disallowed(html), []);
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
