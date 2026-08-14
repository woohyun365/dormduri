import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export type HomeE2eSeedMode = 'current-matching' | 'season-open' | 'post-match' | 'future-preview';

const localDatabaseUrl =
  process.env.HOME_E2E_DATABASE_URL ??
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const apiDir = resolve(process.cwd(), '../api');
const accessTokenTtlSeconds = 60 * 15;
const sessionTtlSeconds = 60 * 60 * 24;

export function resetHomeE2eSeed(mode: HomeE2eSeedMode) {
  const result = spawnSync('node', ['prisma/seed.js'], {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: localDatabaseUrl,
      DIRECT_URL: localDatabaseUrl,
      HOME_E2E_SEED_MODE: mode,
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Home E2E seed reset failed for mode ${mode} with exit code ${result.status}`);
  }
}

export function issueHomeE2eSessionToken(email: string) {
  const sessionId = randomUUID();
  const accessToken = createOpaqueAccessToken(sessionId);
  const sessionTokenHash = hashOpaqueToken(accessToken);
  const now = Date.now();

  const result = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `
        import pg from 'pg';

        const requiredEnv = [
          'DATABASE_URL',
          'HOME_E2E_SESSION_EMAIL',
          'HOME_E2E_SESSION_ID',
          'HOME_E2E_SESSION_TOKEN_HASH',
          'HOME_E2E_SESSION_TOKEN_EXPIRES_AT',
          'HOME_E2E_SESSION_EXPIRES_AT',
        ];
        for (const key of requiredEnv) {
          if (!process.env[key]) {
            throw new Error(\`Missing required env: \${key}\`);
          }
        }

        const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        try {
          const userResult = await client.query(
            'SELECT id FROM "User" WHERE email = $1 AND "deletedAt" IS NULL LIMIT 1',
            [process.env.HOME_E2E_SESSION_EMAIL],
          );
          const userId = userResult.rows[0]?.id;
          if (!userId) {
            throw new Error(\`Home E2E session user not found: \${process.env.HOME_E2E_SESSION_EMAIL}\`);
          }

          await client.query(
            'DELETE FROM "AuthSession" WHERE "userId" = $1 AND "expiresAt" < NOW()',
            [userId],
          );
          await client.query(
            \`
              INSERT INTO "AuthSession" (
                id,
                "userId",
                "rememberMe",
                "sessionTokenHash",
                "sessionTokenExpiresAt",
                "expiresAt",
                "createdAt",
                "updatedAt"
              )
              VALUES ($1, $2, false, $3, $4::timestamptz, $5::timestamptz, NOW(), NOW())
            \`,
            [
              process.env.HOME_E2E_SESSION_ID,
              userId,
              process.env.HOME_E2E_SESSION_TOKEN_HASH,
              process.env.HOME_E2E_SESSION_TOKEN_EXPIRES_AT,
              process.env.HOME_E2E_SESSION_EXPIRES_AT,
            ],
          );
        } finally {
          await client.end();
        }
      `,
    ],
    {
      cwd: apiDir,
      env: {
        ...process.env,
        DATABASE_URL: localDatabaseUrl,
        HOME_E2E_SESSION_EMAIL: email,
        HOME_E2E_SESSION_ID: sessionId,
        HOME_E2E_SESSION_TOKEN_HASH: sessionTokenHash,
        HOME_E2E_SESSION_TOKEN_EXPIRES_AT: new Date(
          now + accessTokenTtlSeconds * 1000,
        ).toISOString(),
        HOME_E2E_SESSION_EXPIRES_AT: new Date(now + sessionTtlSeconds * 1000).toISOString(),
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [`Home E2E session issue failed for ${email} with exit code ${result.status}`, result.stderr]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return accessToken;
}

export function expireHomeE2eAccessToken(accessToken: string) {
  const sessionId = accessToken.split('.')[1];
  if (!sessionId) {
    throw new Error('Home E2E access token does not contain a session id.');
  }

  const result = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `
        import pg from 'pg';

        const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        try {
          const update = await client.query(
            \`
              UPDATE "AuthSession"
              SET "sessionTokenExpiresAt" = NOW() - INTERVAL '1 second',
                  "updatedAt" = NOW()
              WHERE id = $1
                AND "revokedAt" IS NULL
            \`,
            [process.env.HOME_E2E_SESSION_ID],
          );
          if (update.rowCount !== 1) {
            throw new Error(\`Home E2E active session not found: \${process.env.HOME_E2E_SESSION_ID}\`);
          }
        } finally {
          await client.end();
        }
      `,
    ],
    {
      cwd: apiDir,
      env: {
        ...process.env,
        DATABASE_URL: localDatabaseUrl,
        HOME_E2E_SESSION_ID: sessionId,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Home E2E access expiry failed for session ${sessionId} with exit code ${result.status}`,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

function createOpaqueAccessToken(sessionId: string) {
  return `v1.${sessionId}.${randomBytes(32).toString('base64url')}`;
}

function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
