import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

// The inventory names each external image and the one file that pins it. The tag and digest live only in that owner file,
// which Renovate updates, so readers resolve the reference from the owner file instead of keeping a copy.
export const IMAGE_INVENTORY_PATH = 'infra/image-inventory.json';

// Renovate's default managerFilePatterns for the github-actions, dockerfile and docker-compose managers.
const IMAGE_SURFACE_PATTERNS = [
  /(^|\/)(workflow-templates|\.(?:github|gitea|forgejo)\/(?:workflows|actions))\/.+\.ya?ml$/u,
  /(^|\/)action\.ya?ml$/u,
  /(^|\/|\.)([Dd]ocker|[Cc]ontainer)file$/u,
  /(^|\/)([Dd]ocker|[Cc]ontainer)file[^/]*$/u,
  /(^|\/)(?:docker-)?compose[^/]*\.ya?ml$/u,
];
const DOCKERFILE_NAME = /([Dd]ocker|[Cc]ontainer)file/u;
const IMMUTABLE_REFERENCE =
  /^(?<repository>[a-z0-9]+(?:[._/-][a-z0-9]+)*):(?<tag>[A-Za-z0-9_][A-Za-z0-9._-]*)@sha256:[a-f0-9]{64}$/u;
const DEFAULT_VALUE = /^\$\{[A-Za-z_]\w*:-(?<value>[^}]*)\}$/u;

export function loadImageInventory(repoRoot) {
  return JSON.parse(readFileSync(resolve(repoRoot, IMAGE_INVENTORY_PATH), 'utf8'));
}

export function isImageSurface(path) {
  return IMAGE_SURFACE_PATTERNS.some((pattern) => pattern.test(path));
}

export function listImageSurfaces(repoRoot) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0')
    .filter((path) => path && isImageSurface(path));
}

// Repository of an image reference with or without a tag or digest: `prom/prometheus:v3@sha256:…` → `prom/prometheus`.
export function imageRepository(reference) {
  const [name] = reference.split('@');
  const lastSlash = name.lastIndexOf('/');
  const lastColon = name.lastIndexOf(':');
  return lastColon > lastSlash ? name.slice(0, lastColon) : name;
}

export function isImmutableReference(reference) {
  return IMMUTABLE_REFERENCE.test(reference);
}

// External image references in one owner file, as the Renovate managers read them. Locally built images whose name or tag
// is a variable (`knu-roommate-api:${API_IMAGE_TAG:?…}`, `${INGRESS_FIXTURE_IMAGE:?…}`) are not external pins.
export function extractImageReferences(path, source) {
  return DOCKERFILE_NAME.test(basename(path))
    ? extractDockerfileReferences(source)
    : extractYamlImageReferences(source);
}

function extractYamlImageReferences(source) {
  const references = [];
  for (const [, raw] of source.matchAll(/^\s*image:\s*(\S.*?)\s*$/gmu)) {
    const value = unquote(raw);
    const reference = DEFAULT_VALUE.exec(value)?.groups.value ?? value;
    if (!reference.includes('$')) references.push(reference);
  }
  return references;
}

function extractDockerfileReferences(source) {
  const references = [];
  const args = new Map();
  const stages = new Set();
  for (const line of source.split(/\r?\n/u)) {
    const syntax = /^#\s*syntax=(\S+)/u.exec(line);
    if (syntax) {
      references.push(syntax[1]);
      continue;
    }
    const arg = /^\s*ARG\s+(\w+)=(\S*)/iu.exec(line);
    if (arg) {
      args.set(arg[1], unquote(arg[2]));
      continue;
    }
    const from = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/iu.exec(line);
    if (!from) continue;
    const image = from[1].replace(/\$\{(\w+)\}|\$(\w+)/gu, (match, braced, bare) => {
      return args.get(braced ?? bare) ?? match;
    });
    if (from[2]) stages.add(from[2]);
    if (image === 'scratch' || stages.has(image) || image.includes('$')) continue;
    references.push(image);
  }
  return references;
}

function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/u, '$2');
}

// The pinned reference of one inventory image, read from its owner file. Every reference of that repository in the owner
// file must be the same immutable `<tag>@sha256:<digest>`, so one Renovate change updates them together.
export function resolveImageReference(repoRoot, image) {
  const source = readFileSync(resolve(repoRoot, image.ownerPath), 'utf8');
  const references = new Set(
    extractImageReferences(image.ownerPath, source).filter(
      (reference) => imageRepository(reference) === image.repository,
    ),
  );
  if (references.size !== 1) {
    throw new Error(
      `${image.name}: ${image.ownerPath} has ${references.size} distinct ${image.repository} references`,
    );
  }
  const [reference] = references;
  if (!isImmutableReference(reference)) {
    throw new Error(
      `${image.name}: ${image.ownerPath} pins ${image.repository} without <tag>@sha256:<digest>`,
    );
  }
  return reference;
}

// Pins on the Renovate surfaces that the inventory does not list, or that are not immutable.
export function findUnlistedImages(inventory, surfaces) {
  const listed = new Set(
    inventory.images.map(({ ownerPath, repository }) => `${ownerPath}\0${repository}`),
  );
  const problems = [];
  for (const { path, source } of surfaces) {
    for (const reference of extractImageReferences(path, source)) {
      const repository = imageRepository(reference);
      if (!listed.has(`${path}\0${repository}`))
        problems.push(`${path}: ${repository} is not in the inventory`);
      else if (!isImmutableReference(reference))
        problems.push(`${path}: ${reference} is not <tag>@sha256:<digest>`);
    }
  }
  return problems;
}
