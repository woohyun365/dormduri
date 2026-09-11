import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const sourceRoot = join(process.cwd(), 'src');
// Exact transitional exceptions; removing an owner must remove its exception too.
// No wildcard permission for new product or platform imports.
const nativeOwners = {
  'auth/auth.controller.ts': 'temporary: request metadata moves to auth HTTP accessors',
  'auth/application/auth-actor-context.types.ts': 'temporary: actor carrier becomes structural',
  'auth/domain/auth-request-context.ts': 'temporary: pure domain context separates HTTP extraction',
  'chat/chat.controller.ts': 'temporary: IP extraction moves to HTTP accessor',
  'health/health.controller.ts': 'temporary: response headers/status move to HTTP adapter owner',
  'platform/http/http-runtime.ts': 'native bootstrap: trust-proxy and middleware lifecycle',
  'platform/http/http-cookie-policy.ts': 'temporary: remove unused API-only cookie policy',
  'platform/http/api-exception.filter.ts':
    'response writer: preserve native non-JSON error compatibility',
  'platform/observability/logging/request-context.middleware.ts':
    'request ID/ALS and middleware next',
  'platform/observability/logging/request-logging.interceptor.ts':
    'native response finish/close/error lifecycle',
  'platform/observability/logging/request-route.ts': 'route-template and originalUrl extraction',
  'platform/observability/logging/exception-log.mapper.ts': 'exception method/route/path metadata',
  'platform/observability/metrics/http-metrics.interceptor.ts':
    'native response completion and exactly-once metrics',
  'platform/observability/metrics/metrics.controller.ts':
    'scrape response content-type before registry collection',
  'platform/observability/metrics/metrics-auth.guard.ts':
    'temporary: authorization header carrier becomes structural',
} satisfies Record<string, string>;

function nativeModule(name: string) {
  return ['express', 'cookie-parser', '@nestjs/platform-express'].some(
    (module) => name === module || name.startsWith(`${module}/`),
  );
}

function nativeImports(source: string): string[] {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  const modules: string[] = [];
  function add(node: ts.Node | undefined) {
    if (node && ts.isStringLiteralLike(node) && nativeModule(node.text)) modules.push(node.text);
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
      add(node.moduleReference.expression);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      add(node.argument.literal);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      add(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...new Set(modules)].sort();
}

function violations(path: string, source: string): string[] {
  return nativeImports(source)
    .filter((module) => {
      if (module === 'cookie-parser') return path !== 'platform/http/http-runtime.ts';
      return module !== 'express' || !Object.hasOwn(nativeOwners, path);
    })
    .map((module) => `${path}: ${module}`);
}

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'generated') return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return entry.isFile() && path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('HTTP transport boundary', () => {
  it('permits only the current exact native owners and reports stale exceptions', () => {
    const files = productionFiles(sourceRoot);
    expect(
      files.flatMap((path) =>
        violations(relative(sourceRoot, path).split(sep).join('/'), readFileSync(path, 'utf8')),
      ),
    ).toEqual([]);
    for (const [path, reason] of Object.entries(nativeOwners)) {
      expect(reason.length).toBeGreaterThan(0);
      expect(existsSync(join(sourceRoot, path)), path).toBe(true);
      expect(nativeImports(readFileSync(join(sourceRoot, path), 'utf8')), path).toContain(
        'express',
      );
    }
  });

  it.each([
    `import type { Request as NativeRequest } from 'express';`,
    `export type { Response } from 'express';`,
    `const server = require('express');`,
    `const server = import('express');`,
    `type Request = import('express').Request;`,
    `import express = require('express');`,
    `import { response } from 'express/lib/response';`,
    `import { ExpressAdapter } from '@nestjs/platform-express';`,
  ])('rejects a new nested product import: %s', (source) => {
    expect(violations('support/application/nested/example.ts', source)).toHaveLength(1);
  });

  it('does not grant a blanket exception to platform files or cookie imports', () => {
    expect(
      violations('platform/http/new-owner.ts', `import type { Request } from 'express';`),
    ).toHaveLength(1);
    expect(
      violations('auth/auth.controller.ts', `import parser from 'cookie-parser';`),
    ).toHaveLength(1);
  });

  it('allows native owners, temporary product debt and normal framework imports', () => {
    for (const path of Object.keys(nativeOwners))
      expect(violations(path, `import type { Request } from 'express';`)).toEqual([]);
    expect(
      violations('platform/http/http-runtime.ts', `import parser from 'cookie-parser';`),
    ).toEqual([]);
    expect(
      violations('support/support.controller.ts', `import { Body } from '@nestjs/common';`),
    ).toEqual([]);
    expect(
      violations(
        'support/support.controller.ts',
        `// import type { Request } from 'express';\nconst text = "express";`,
      ),
    ).toEqual([]);
  });
});
