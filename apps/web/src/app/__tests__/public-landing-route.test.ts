import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readAppSource = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), 'src', 'app', relativePath), 'utf8');

describe('public landing route boundary', () => {
  const pageSource = readAppSource('page.tsx');

  it.fails('root route는 GatewayPage session gateway를 import하지 않는다', () => {
    expect(pageSource).not.toContain('GatewayPage');
    expect(pageSource).not.toMatch(/@\/components\/GatewayPage|components\/GatewayPage/);
  });

  it.fails(
    'root route는 request-time session check 때문에 force-dynamic으로 고정하지 않는다',
    () => {
      expect(pageSource).not.toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
    },
  );

  it.fails('root route는 public Landing shell을 직접 소유한다', () => {
    expect(pageSource).toMatch(/@\/landing\/(LandingPage|Landing)|landing\/(LandingPage|Landing)/);
    expect(pageSource).toMatch(/<Landing(Page)?\s*\/?/);
  });
});
