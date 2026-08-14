import { chmod, mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MountedFileSecretReader } from '../../../src/config/secrets/readers/mounted-file-secret-reader.js';

describe('MountedFileSecretReader', () => {
  it('reads a regular secret file from the configured root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mounted-secrets-'));
    await writeFile(join(root, 'DATABASE_URL'), 'postgresql://api:secret@db/api\n', {
      mode: 0o600,
    });

    await expect(new MountedFileSecretReader(root).readSecret('DATABASE_URL')).resolves.toBe(
      'postgresql://api:secret@db/api',
    );
  });

  it.each([
    ['path traversal', '../DATABASE_URL', 'INVALID_PATH'],
    ['nested path', 'nested/DATABASE_URL', 'INVALID_PATH'],
  ])('rejects %s', async (_label, name, code) => {
    const root = await mkdtemp(join(tmpdir(), 'mounted-secrets-'));
    await expect(new MountedFileSecretReader(root).readSecret(name)).rejects.toMatchObject({
      code,
    });
  });

  it('rejects symbolic links and non-regular files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mounted-secrets-'));
    const outside = join(await mkdtemp(join(tmpdir(), 'mounted-secret-outside-')), 'value');
    await writeFile(outside, 'secret');
    await symlink(outside, join(root, 'DATABASE_URL'));
    await mkdir(join(root, 'JWT_ACCESS_SECRET'));
    const reader = new MountedFileSecretReader(root);

    await expect(reader.readSecret('DATABASE_URL')).rejects.toMatchObject({ code: 'UNSAFE_FILE' });
    await expect(reader.readSecret('JWT_ACCESS_SECRET')).rejects.toMatchObject({
      code: 'UNSAFE_FILE',
    });
  });

  it('rejects missing, blank, and oversized values with bounded codes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mounted-secrets-'));
    await writeFile(join(root, 'BLANK_SECRET'), '  \n');
    await writeFile(join(root, 'LARGE_SECRET'), '12345');
    const reader = new MountedFileSecretReader(root, { maxBytes: 4 });

    await expect(reader.readSecret('MISSING_SECRET')).rejects.toMatchObject({ code: 'MISSING' });
    await expect(reader.readSecret('BLANK_SECRET')).rejects.toMatchObject({ code: 'MISSING' });
    await expect(reader.readSecret('LARGE_SECRET')).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });

  it.runIf(typeof process.getuid === 'function' && process.getuid() !== 0)(
    'maps an unreadable file to access denied',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'mounted-secrets-'));
      const path = join(root, 'DATABASE_URL');
      await writeFile(path, 'private-value', { mode: 0o600 });
      await chmod(path, 0o000);

      await expect(
        new MountedFileSecretReader(root).readSecret('DATABASE_URL'),
      ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    },
  );
});
