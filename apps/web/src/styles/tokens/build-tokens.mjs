// Builds tokens.generated.css from the DTCG 2025.10 resolver document next to this file.
// It supports only the formats the KNU tokens use; anything else fails instead of guessing.
// Run from apps/web: node src/styles/tokens/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RESOLVER_FILE = 'knu.resolver.json';
export const GENERATED_CSS_FILE = 'tokens.generated.css';

const RESOLVER_VERSION = '2025.10';
const VENDOR = 'knu-roommate';
const PRIMITIVE_ROOT = 'primitive';
const ROOT_TOKEN = '$root';
// Tailwind theme namespaces; tokens under any other root become plain :root variables.
const THEME_NAMESPACES = new Set([
  'color',
  'text',
  'font',
  'radius',
  'spacing',
  'container',
  'ease',
]);
// Tailwind reads these as `--text-<step>--<property>` companions of a type step.
const TEXT_PROPERTIES = new Set(['line-height', 'letter-spacing', 'font-weight']);
const TOKEN_PROPERTIES = new Set(['$value', '$type', '$description', '$extensions']);
const GROUP_PROPERTIES = new Set(['$type', '$description', '$extensions']);
const DOCUMENT_PROPERTIES = new Set([...GROUP_PROPERTIES, '$schema']);
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);
const FONT_WEIGHT_NAMES = new Map([
  ['thin', 100],
  ['hairline', 100],
  ['extra-light', 200],
  ['ultra-light', 200],
  ['light', 300],
  ['normal', 400],
  ['regular', 400],
  ['book', 400],
  ['medium', 500],
  ['semi-bold', 600],
  ['demi-bold', 600],
  ['bold', 700],
  ['extra-bold', 800],
  ['ultra-bold', 800],
  ['black', 900],
  ['heavy', 900],
  ['extra-black', 950],
  ['ultra-black', 950],
]);
const ALIAS = /^\{([^{}]+)\}$/u;
// A modifier context applies under a media query, inside elements that carry one data attribute value,
// or inside such elements while a media query matches. A context may list several of these conditions.
const CONTEXT_SELECTOR = /^\[data-[a-z][a-z0-9-]*='[a-z0-9-]+'\]$/u;
const CONTEXT_CONDITION_KEYS = new Set(['media', 'selector', 'nestable']);

export class TokenFormatError extends Error {
  name = 'TokenFormatError';
}

function fail(message) {
  throw new TokenFormatError(message);
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// ---- resolver document ----------------------------------------------------------------------

function sourcesOf(entries, where, readRef) {
  if (!Array.isArray(entries)) fail(`${where} must be an array of token sources`);
  return entries.map((entry) => {
    if (!isObject(entry)) fail(`${where} has a source that is not an object`);
    if (!('$ref' in entry)) return entry;
    const ref = entry.$ref;
    if (typeof ref !== 'string' || !/^[\w.-]+\.json$/u.test(ref)) {
      fail(`${where} may only reference a .json file next to the resolver, got ${String(ref)}`);
    }
    const source = readRef(ref);
    if (source === undefined) fail(`${where} references missing file ${ref}`);
    return source;
  });
}

/**
 * Lists the token documents of one resolver input in resolutionOrder.
 * `input` maps modifier names to context names; missing modifiers use their default.
 */
export function collectResolverSources(resolver, input, readRef) {
  if (!isObject(resolver)) fail('resolver document must be an object');
  if (resolver.version !== RESOLVER_VERSION) {
    fail(`resolver version must be "${RESOLVER_VERSION}", got ${String(resolver.version)}`);
  }
  const sets = resolver.sets ?? {};
  const modifiers = resolver.modifiers ?? {};
  for (const [name, modifier] of Object.entries(modifiers)) {
    const contexts = Object.keys(modifier?.contexts ?? {});
    if (contexts.length < 2) fail(`modifier "${name}" needs two or more contexts`);
    if (!contexts.includes(modifier.default)) {
      fail(`modifier "${name}" default "${String(modifier.default)}" is not one of its contexts`);
    }
  }
  for (const [name, context] of Object.entries(input)) {
    if (!(name in modifiers)) fail(`input names unknown modifier "${name}"`);
    if (typeof context !== 'string' || !(context in modifiers[name].contexts)) {
      fail(`modifier "${name}" has no context "${String(context)}"`);
    }
  }
  if (!Array.isArray(resolver.resolutionOrder)) fail('resolver needs a resolutionOrder array');

  return resolver.resolutionOrder.flatMap((entry) => {
    const ref = isObject(entry) ? entry.$ref : undefined;
    const match = typeof ref === 'string' ? /^#\/(sets|modifiers)\/([^/]+)$/u.exec(ref) : null;
    if (!match)
      fail(`resolutionOrder supports only #/sets/<name> and #/modifiers/<name> references`);
    const [, kind, name] = match;
    if (kind === 'sets') {
      if (!isObject(sets[name])) fail(`resolutionOrder has unknown reference ${ref}`);
      return sourcesOf(sets[name].sources, `set "${name}"`, readRef);
    }
    if (!isObject(modifiers[name])) fail(`resolutionOrder has unknown reference ${ref}`);
    const context = input[name] ?? modifiers[name].default;
    return sourcesOf(
      modifiers[name].contexts[context],
      `modifier "${name}" context "${context}"`,
      readRef,
    );
  });
}

// ---- token documents ------------------------------------------------------------------------

function checkName(name, where) {
  if (name.startsWith('$') || /[{}.]/u.test(name) || name.length === 0) {
    fail(`invalid name "${name}" in ${where || 'document root'}`);
  }
}

function collectDefinitions(document, definitions, groups) {
  if (!isObject(document)) fail('token source must be an object');
  const visit = (node, segments, inheritedType, allowed) => {
    const where = segments.join('.');
    for (const key of Object.keys(node)) {
      if (key.startsWith('$') && key !== ROOT_TOKEN && !allowed.has(key)) {
        fail(`unsupported property "${key}" at ${where || 'document root'}`);
      }
    }
    if (node.$type !== undefined && typeof node.$type !== 'string') {
      fail(`$type at ${where || 'document root'} must be a string`);
    }
    const groupType = node.$type ?? inheritedType;
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$') && key !== ROOT_TOKEN) continue;
      if (key !== ROOT_TOKEN) checkName(key, where);
      const childSegments = [...segments, key];
      const childPath = childSegments.join('.');
      if (!isObject(child)) fail(`${childPath} must be a token or a group object`);
      if ('$value' in child) {
        for (const property of Object.keys(child)) {
          if (!TOKEN_PROPERTIES.has(property)) {
            fail(`unsupported property "${property}" at ${childPath}`);
          }
        }
        if (groups.has(childPath)) fail(`${childPath} is a group in another source`);
        definitions.set(childPath, { ...child, inheritedType: groupType });
      } else {
        if (key === ROOT_TOKEN) fail(`${childPath} must be a token`);
        if (definitions.has(childPath)) fail(`${childPath} is a token in another source`);
        groups.add(childPath);
        visit(child, childSegments, groupType, GROUP_PROPERTIES);
      }
    }
  };
  visit(document, [], undefined, DOCUMENT_PROPERTIES);
}

function validateValue(type, value, where) {
  switch (type) {
    case 'color': {
      if (!isObject(value) || value.colorSpace !== 'srgb') {
        fail(`color at ${where} must use colorSpace "srgb"`);
      }
      const { components, alpha = 1, hex } = value;
      if (
        !Array.isArray(components) ||
        components.length !== 3 ||
        !components.every((c) => isNumber(c) && c >= 0 && c <= 1)
      ) {
        fail(`color at ${where} needs three srgb components within 0..1`);
      }
      if (alpha !== 1) fail(`color at ${where} must have alpha 1 (tokens are opaque)`);
      const expected = `#${components
        .map((c) =>
          Math.round(c * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`;
      if (typeof hex !== 'string' || hex.toLowerCase() !== expected) {
        fail(`color at ${where} has hex ${String(hex)} but its components give ${expected}`);
      }
      return { colorSpace: 'srgb', components: [...components], alpha: 1, hex: expected };
    }
    case 'dimension':
      if (!isObject(value) || !isNumber(value.value) || !['px', 'rem'].includes(value.unit)) {
        fail(`dimension at ${where} must be { value, unit } with unit "px" or "rem"`);
      }
      return { value: value.value, unit: value.unit };
    case 'duration':
      if (!isObject(value) || !isNumber(value.value) || value.value < 0 || value.unit !== 'ms') {
        fail(`duration at ${where} must be { value, unit } with unit "ms"`);
      }
      return { value: value.value, unit: 'ms' };
    case 'cubicBezier':
      if (!Array.isArray(value) || value.length !== 4 || !value.every(isNumber)) {
        fail(`cubicBezier at ${where} must be four numbers`);
      }
      if (value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1) {
        fail(`cubicBezier at ${where} needs x values within 0..1`);
      }
      return [...value];
    case 'fontFamily': {
      const families = typeof value === 'string' ? [value] : value;
      if (
        !Array.isArray(families) ||
        families.length === 0 ||
        !families.every((family) => typeof family === 'string' && family.trim() !== '')
      ) {
        fail(`fontFamily at ${where} must be a font name or a list of font names`);
      }
      return [...families];
    }
    case 'fontWeight': {
      const weight = typeof value === 'string' ? FONT_WEIGHT_NAMES.get(value) : value;
      if (!isNumber(weight) || weight < 1 || weight > 1000) {
        fail(`fontWeight at ${where} must be 1..1000 or a DTCG weight name`);
      }
      return weight;
    }
    case 'number':
      if (!isNumber(value)) fail(`number at ${where} must be a finite number`);
      return value;
    default:
      return fail(`unsupported $type "${type}" at ${where}`);
  }
}

/**
 * Merges token documents in order (later definitions replace earlier ones), resolves aliases and
 * validates every value. Returns tokens keyed by their dotted path.
 */
export function resolveTokenSources(sources) {
  const definitions = new Map();
  const groups = new Set();
  for (const source of sources) collectDefinitions(source, definitions, groups);

  const resolved = new Map();
  const resolve = (tokenPath, chain) => {
    if (resolved.has(tokenPath)) return resolved.get(tokenPath);
    if (chain.includes(tokenPath)) {
      fail(`circular alias ${[...chain, tokenPath].join(' -> ')}`);
    }
    const definition = definitions.get(tokenPath);
    const raw = definition.$value;
    const alias = typeof raw === 'string' ? ALIAS.exec(raw) : null;
    let type = definition.$type ?? definition.inheritedType;
    let value;
    if (alias) {
      const target = alias[1];
      if (!definitions.has(target)) {
        if (groups.has(target))
          fail(`alias at ${tokenPath} points to group "${target}", not a token`);
        fail(`alias at ${tokenPath} points to unknown token "${target}"`);
      }
      const resolvedTarget = resolve(target, [...chain, tokenPath]);
      if (type !== undefined && type !== resolvedTarget.type) {
        fail(`alias at ${tokenPath} is ${type} but "${target}" is ${resolvedTarget.type}`);
      }
      type = resolvedTarget.type;
      value = resolvedTarget.value;
    } else {
      if (type === undefined) fail(`token "${tokenPath}" has no $type`);
      value = validateValue(type, raw, tokenPath);
    }
    if (typeof type !== 'string') fail(`$type at ${tokenPath} must be a string`);
    const token = { path: tokenPath, type, value, extensions: definition.$extensions ?? {} };
    resolved.set(tokenPath, token);
    return token;
  };
  for (const tokenPath of definitions.keys()) resolve(tokenPath, []);
  return resolved;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readResolver(dir) {
  const resolver = readJson(path.join(dir, RESOLVER_FILE));
  const readRef = (ref) => readJson(path.join(dir, ref));
  return { resolver, readRef };
}

/** Resolves the tokens of one resolver input (default: every modifier at its default context). */
export function loadTokens(dir, input = {}) {
  const { resolver, readRef } = readResolver(dir);
  return resolveTokenSources(collectResolverSources(resolver, input, readRef));
}

// ---- CSS ------------------------------------------------------------------------------------

function cssName(tokenPath) {
  const segments = tokenPath.split('.');
  if (segments.at(-1) === ROOT_TOKEN) segments.pop();
  const property = segments.at(-1);
  if (segments[0] === 'text' && segments.length === 3 && TEXT_PROPERTIES.has(property)) {
    return `--text-${segments[1]}--${property}`;
  }
  return `--${segments.join('-')}`;
}

function vendorData(token) {
  const data = token.extensions[VENDOR] ?? {};
  if (!isObject(data)) fail(`$extensions["${VENDOR}"] at ${token.path} must be an object`);
  for (const key of Object.keys(data)) {
    if (key !== 'cssVariables')
      fail(`unsupported $extensions["${VENDOR}"].${key} at ${token.path}`);
  }
  return data;
}

function quoteFamily(family) {
  return GENERIC_FAMILIES.has(family) ? family : `'${family.replaceAll("'", "\\'")}'`;
}

// Returns the CSS value and whether it references another variable (written to @theme inline).
function cssValue(token) {
  const { type, value } = token;
  switch (type) {
    case 'color':
      return { css: value.hex, references: false };
    case 'dimension':
    case 'duration':
      return { css: `${value.value}${value.unit}`, references: false };
    case 'cubicBezier':
      return { css: `cubic-bezier(${value.join(', ')})`, references: false };
    case 'fontFamily': {
      const variables = vendorData(token).cssVariables ?? {};
      for (const [family, variable] of Object.entries(variables)) {
        if (!value.includes(family) || !/^--[a-z0-9-]+$/u.test(variable)) {
          fail(`cssVariables at ${token.path} must map one of its families to a --variable`);
        }
      }
      const parts = value.map((family) =>
        family in variables ? `var(${variables[family]})` : quoteFamily(family),
      );
      return { css: parts.join(', '), references: value.some((family) => family in variables) };
    }
    default:
      return { css: String(value), references: false };
  }
}

function block(selector, lines, indent = '') {
  return lines.length === 0 ? null : `${indent}${selector} {\n${lines.join('\n')}\n${indent}}`;
}

// Puts a blank line between token roots inside a block.
function declarations(tokens, indent) {
  const lines = [];
  let previousRoot;
  for (const token of tokens) {
    const root = token.path.split('.')[0];
    if (previousRoot !== undefined && root !== previousRoot) lines.push('');
    lines.push(`${indent}${cssName(token.path)}: ${cssValue(token).css};`);
    previousRoot = root;
  }
  return lines;
}

function exported(tokens) {
  return [...tokens.values()].filter((token) => !token.path.startsWith(`${PRIMITIVE_ROOT}.`));
}

// Reads the cssContexts entry of one modifier context as a list of { media?, selector?, nestable? }
// conditions. A nestable selector (nestable: "true") writes every token any context of the same
// modifier changes, so the context can sit inside another one (a light surface in a dark page).
function contextConditions(entry, where) {
  const conditions = Array.isArray(entry) ? entry : [entry];
  const valid =
    conditions.length > 0 &&
    conditions.every(
      (condition) =>
        isObject(condition) &&
        Object.keys(condition).length > 0 &&
        Object.entries(condition).every(
          ([key, value]) =>
            CONTEXT_CONDITION_KEYS.has(key) && typeof value === 'string' && value !== '',
        ),
    );
  if (!valid) {
    fail(`${where} needs a { media } or { selector } cssContexts entry (both, or a list of them)`);
  }
  for (const { selector, media, nestable } of conditions) {
    if (selector !== undefined && !CONTEXT_SELECTOR.test(selector)) {
      fail(`${where} selector must look like [data-name='value'], got ${selector}`);
    }
    if (nestable === undefined) continue;
    if (nestable !== 'true') fail(`${where} nestable must be "true"`);
    if (selector === undefined || media !== undefined) {
      fail(`${where} nestable condition needs a selector and no media`);
    }
  }
  return conditions;
}

function contextBlock({ media, selector }, changed) {
  if (media === undefined) return block(selector, declarations(changed, '  '));
  const inner = block(selector ?? ':root', declarations(changed, '    '), '  ');
  return inner && `@media ${media} {\n${inner}\n}`;
}

/** Renders tokens.generated.css for the resolver in `dir`. */
export function buildTokenCss(dir) {
  const { resolver, readRef } = readResolver(dir);
  const base = resolveTokenSources(collectResolverSources(resolver, {}, readRef));
  const tokens = exported(base);

  const names = new Map();
  for (const token of tokens) {
    const name = cssName(token.path);
    if (names.has(name)) fail(`${token.path} and ${names.get(name)} both map to ${name}`);
    names.set(name, token.path);
  }

  const isTheme = (token) => THEME_NAMESPACES.has(token.path.split('.')[0]);
  const theme = tokens.filter((token) => isTheme(token) && !cssValue(token).references);
  const themeInline = tokens.filter((token) => isTheme(token) && cssValue(token).references);
  const root = tokens.filter((token) => !isTheme(token));

  const contexts = [];
  // Token paths each plain selector context changed. A selector context under a media query (e.g. the
  // dark values of an auto scheme) also writes these paths, so it never leaves an earlier context's
  // value in place where its own value equals the default.
  const scopedPaths = new Map();
  for (const [name, modifier] of Object.entries(resolver.modifiers ?? {})) {
    const cssContexts = modifier.$extensions?.[VENDOR]?.cssContexts ?? {};
    const resolved = [];
    // Every token path some context of this modifier changes (what a nestable selector writes).
    const touched = new Set();
    for (const context of Object.keys(modifier.contexts)) {
      if (context === modifier.default) continue;
      const conditions = contextConditions(
        cssContexts[context],
        `modifier "${name}" context "${context}"`,
      );
      const variant = resolveTokenSources(
        collectResolverSources(resolver, { [name]: context }, readRef),
      );
      const changed = exported(variant).filter((token) => {
        const before = base.get(token.path);
        if (!before) fail(`modifier "${name}" context "${context}" adds ${token.path}`);
        return cssValue(token).css !== cssValue(before).css;
      });
      for (const token of changed) {
        if (cssValue(token).references || cssValue(base.get(token.path)).references) {
          fail(`modifier "${name}" cannot override inline theme token ${token.path}`);
        }
        touched.add(token.path);
      }
      resolved.push({ conditions, variant, changed });
    }
    // The default context can only have nestable selectors: they write the default value of every
    // path another context changes, so a default surface can sit inside another context.
    if (cssContexts[modifier.default] !== undefined) {
      const where = `modifier "${name}" default context "${modifier.default}"`;
      const conditions = contextConditions(cssContexts[modifier.default], where);
      if (conditions.some((condition) => condition.nestable !== 'true')) {
        fail(`${where} can only have nestable selectors`);
      }
      resolved.push({ conditions, variant: base, changed: [] });
    }
    for (const { conditions, variant, changed } of resolved) {
      for (const condition of conditions) {
        const { media, selector, nestable } = condition;
        let tokens = changed;
        if (nestable === 'true') {
          tokens = exported(variant).filter((token) => touched.has(token.path));
        } else if (selector !== undefined && media === undefined) {
          scopedPaths.set(
            selector,
            new Set([...(scopedPaths.get(selector) ?? []), ...changed.map((token) => token.path)]),
          );
        } else if (selector !== undefined) {
          const earlier = scopedPaths.get(selector) ?? new Set();
          tokens = exported(variant).filter(
            (token) => changed.includes(token) || earlier.has(token.path),
          );
        }
        const scoped = contextBlock(condition, tokens);
        if (scoped) contexts.push(scoped);
      }
    }
  }

  const header = [
    `/* Generated from ${RESOLVER_FILE} by build-tokens.mjs. Do not edit by hand.`,
    ' * Rebuild from apps/web: node src/styles/tokens/build-tokens.mjs */',
  ].join('\n');
  return `${[
    header,
    block('@theme', declarations(theme, '  ')),
    block('@theme inline', declarations(themeInline, '  ')),
    block(':root', declarations(root, '  ')),
    ...contexts,
  ]
    .filter(Boolean)
    .join('\n\n')}\n`;
}

// ---- contrast -------------------------------------------------------------------------------

function channel(component) {
  const value = Math.round(component * 255) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  const [red, green, blue] = color.components;
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG 2.2 contrast ratio of two opaque sRGB colors. */
export function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const dir = path.dirname(thisFile);
  writeFileSync(path.join(dir, GENERATED_CSS_FILE), buildTokenCss(dir));
  console.log(`wrote ${path.join(dir, GENERATED_CSS_FILE)}`);
}
