import { createHash } from 'node:crypto';

import {
  IMAGE_INVENTORY_PATH,
  resolveImageReferenceInSource,
} from '../../infra/artifacts/image-inventory.mjs';

// A CI performance sample belongs to the cohort of its run head dependency inputs. Samples are compared only when these
// hashes are equal, so a sample never needs a hand-maintained measurement period.
export const dependencyInputPaths = ['pnpm-lock.yaml', 'pnpm-workspace.yaml', IMAGE_INVENTORY_PATH];

const SUPPORTED_IMAGE_INVENTORY_VERSION = 2;

function assertSha(value, path, length) {
  if (typeof value !== 'string' || !new RegExp(`^[a-f0-9]{${length}}$`, 'u').test(value)) {
    throw new TypeError(`${path} must be a lowercase ${length}-character SHA`);
  }
}

// The image inventory names each external image and its owner file; the tag and digest live only in that owner file. Its
// input text adds every reference resolved from the owner files, so an update that moves only an image tag or digest still
// changes the fingerprint.
function dependencyInputText(path, readString) {
  const content = readString(path);
  if (path !== IMAGE_INVENTORY_PATH) return content;
  const inventory = JSON.parse(content);
  if (inventory.version !== SUPPORTED_IMAGE_INVENTORY_VERSION) {
    throw new TypeError(
      `${IMAGE_INVENTORY_PATH} version ${inventory.version} is not supported; only version ${SUPPORTED_IMAGE_INVENTORY_VERSION} owner-file inventories are fingerprinted`,
    );
  }
  const references = inventory.images.map(
    (image) => `${image.name} ${resolveImageReferenceInSource(image, readString(image.ownerPath))}`,
  );
  return [content, ...references].join('\n');
}

export function buildDependencyFingerprint({ readText, sourceSha }) {
  if (typeof readText !== 'function') throw new TypeError('readText must be a function');
  assertSha(sourceSha, 'sourceSha', 40);
  const texts = new Map();
  const readString = (path) => {
    if (!texts.has(path)) {
      const content = readText(path);
      if (typeof content !== 'string') {
        throw new TypeError(`readText(${path}) must return a string`);
      }
      texts.set(path, content);
    }
    return texts.get(path);
  };
  const fileSha256 = Object.fromEntries(
    dependencyInputPaths.map((path) => [
      path,
      createHash('sha256').update(dependencyInputText(path, readString)).digest('hex'),
    ]),
  );
  return { fileSha256, sourceSha };
}
