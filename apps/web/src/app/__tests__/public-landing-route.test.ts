import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readAppSource = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), 'src', 'app', relativePath), 'utf8');

const collectSources = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return collectSources(absolutePath);
    }

    return /\.(tsx?|jsx?)$/.test(entry) ? [readFileSync(absolutePath, 'utf8')] : [];
  });

describe('public landing route boundary', () => {
  const pageSource = readAppSource('page.tsx');

  it('root route는 GatewayPage session gateway를 import하지 않는다', () => {
    expect(pageSource).not.toContain('GatewayPage');
    expect(pageSource).not.toMatch(/@\/components\/GatewayPage|components\/GatewayPage/);
  });

  it('root route는 request-time session check 때문에 force-dynamic으로 고정하지 않는다', () => {
    expect(pageSource).not.toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('root route는 Landing 화면 계층의 공개 entry만 렌더링한다', () => {
    const screenImports = [...pageSource.matchAll(/from\s+['"](@\/screens\/[^'"]*)['"]/g)].map(
      ([, specifier]) => specifier,
    );

    expect(screenImports).toEqual(['@/screens/landing']);
    expect(pageSource).toMatch(/<LandingScreen\s*\/?/);
  });

  it('Landing source는 다른 Web 화면 계층을 import하지 않는다', () => {
    const landingSources = collectSources(path.join(process.cwd(), 'src', 'screens', 'landing'));

    for (const source of landingSources) {
      const webImports = [...source.matchAll(/from\s+['"](@\/[^'"]*)['"]/g)].map(
        ([, specifier = '']) => specifier,
      );
      expect(webImports.filter((specifier) => !specifier.startsWith('@/screens/ui/'))).toEqual([]);
    }
  });

  it('Landing source는 인증 앱 shell skeleton을 직접 소유하지 않는다', () => {
    const landingSources = collectSources(path.join(process.cwd(), 'src', 'screens', 'landing'));

    for (const source of landingSources) {
      expect(source).not.toMatch(/from\s+['"][^'"]*AppShellSkeleton/);
      expect(source).not.toMatch(/from\s+['"][^'"]*GatewaySkeleton/);
      expect(source).not.toMatch(/from\s+['"]@\/components\/Skeleton['"]/);
      expect(source).not.toMatch(/from\s+['"][^'"]*components\/Skeleton['"]/);
    }
  });
});
