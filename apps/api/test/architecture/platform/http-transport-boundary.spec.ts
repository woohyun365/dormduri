import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const sourceRoot = join(process.cwd(), 'src');
// Exact Express runtime owners; Node lifecycle types need no Express exception.
// No wildcard permission for new product or platform imports.
const nativeOwners = {
  'platform/http/http-runtime.ts': 'Express trust-proxy and middleware registration',
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

  it.each([
    'platform/observability/logging/request-context.middleware.ts',
    'platform/observability/logging/request-logging.interceptor.ts',
    'platform/observability/metrics/http-metrics.interceptor.ts',
  ])('rejects broad Express types in the Node lifecycle owner %s', (path) => {
    expect(violations(path, `import type { Response } from 'express';`)).toHaveLength(1);
    expect(violations(path, `import type { ServerResponse } from 'node:http';`)).toEqual([]);
  });

  it('allows exact Express runtime owners and normal framework imports', () => {
    for (const path of Object.keys(nativeOwners))
      expect(violations(path, `import type { Request } from 'express';`)).toEqual([]);
    expect(
      violations('platform/http/http-runtime.ts', `import parser from 'cookie-parser';`),
    ).toHaveLength(1);
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

function manualControllerParsing(source: string): string[] {
  const file = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
  const helpers = new Set<string>();
  const namespaces = new Set<string>();
  for (const node of file.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      !node.moduleSpecifier.text.endsWith('/zod-request.js')
    )
      continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const specifier of bindings.elements) helpers.add(specifier.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  const violations: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isMethodDeclaration(node) && node.body) {
      const methodName = node.name.getText(file);
      function inspect(bodyNode: ts.Node) {
        if (ts.isCallExpression(bodyNode)) {
          const callee = bodyNode.expression;
          if (
            (ts.isIdentifier(callee) && helpers.has(callee.text)) ||
            (ts.isPropertyAccessExpression(callee) &&
              ts.isIdentifier(callee.expression) &&
              namespaces.has(callee.expression.text))
          )
            violations.push(`${methodName}: ${callee.getText(file)}`);
        }
        ts.forEachChild(bodyNode, inspect);
      }
      inspect(node.body);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return violations;
}

describe('general request parsing belongs to parameter binding', () => {
  it('all current controller handlers delegate parsed values, not general helpers', () => {
    const manual = productionFiles(sourceRoot)
      .filter((path) => path.endsWith('.controller.ts'))
      .flatMap((path) =>
        manualControllerParsing(readFileSync(path, 'utf8')).map(
          (finding) => `${relative(sourceRoot, path)}: ${finding}`,
        ),
      );
    expect(manual).toEqual([]);
  });
  it.each([
    [
      "import { parseRequestBody } from '../platform/http/zod-request.js';",
      'parseRequestBody(schema, body)',
    ],
    [
      "import { parseQueryObject as parse } from '../platform/http/zod-request.js';",
      'parse(schema, query)',
    ],
    [
      "import * as parsing from '../platform/http/zod-request.js';",
      'parsing.parsePathParam(schema, id)',
    ],
  ])('rejects manual general parsing, including aliases: %s', (imports, call) => {
    expect(
      manualControllerParsing(`${imports} class Controller { route(input) { return ${call}; } }`),
    ).toHaveLength(1);
  });
  it('allows parameter callbacks and local semantic policy parsing', () => {
    expect(
      manualControllerParsing(`
      import { parseRequestBody } from '../platform/http/zod-request.js';
      class Controller {
        route(@Body(new ZodRequestPipe(body => parseRequestBody(schema, body))) parsed) {
          return service(parseLocalSemanticValue(parsed));
        }
      }
    `),
    ).toEqual([]);
  });
});
