import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

// ESLint and typescript-eslint resolve from apps/api, like eslint.config.mjs.
const requireFromApi = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { ESLint } = requireFromApi('eslint') as typeof import('eslint');
const tseslint = requireFromApi('typescript-eslint') as {
  configs: { disableTypeChecked: Linter.Config };
};

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const screensReadme = 'apps/web/src/screens/README.md';
const boundaryRuleIds = ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-syntax'];
const fixtureFile = 'src/renderer-neutral/case.ts';

// The package config is type-checked and fixture paths are not on disk, so fixtures and the source
// scan lint without type information. The boundary rules are syntactic.
const untypedParse: Linter.Config = { ...tseslint.configs.disableTypeChecked, files: ['**/*.ts'] };
const eslint = new ESLint({ cwd: packageRoot });
const untypedLinter = new ESLint({ cwd: packageRoot, overrideConfig: [untypedParse] });

async function lint(filePath: string, lines: string[]) {
  const [result] = await untypedLinter.lintText(`${lines.join('\n')}\n`, {
    filePath: path.join(packageRoot, filePath),
  });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  return result.messages;
}

function boundaryErrors(messages: Linter.LintMessage[]) {
  return messages.filter(
    (message) => boundaryRuleIds.includes(message.ruleId ?? '') && message.severity === 2,
  );
}

function errorLines(messages: Linter.LintMessage[], ruleId: string) {
  return [
    ...new Set(
      messages
        .filter((message) => message.ruleId === ruleId && message.severity === 2)
        .map((message) => message.line),
    ),
  ];
}

async function severityOf(filePath: string, ruleId: string) {
  const config = (await eslint.calculateConfigForFile(path.join(packageRoot, filePath))) as
    Linter.Config | undefined;
  const entry = config?.rules?.[ruleId];
  return Array.isArray(entry) ? entry[0] : entry;
}

const forbiddenImports: Array<[string, string]> = [
  // family마다 값 import 하나
  ['next import', "import next from 'next';"],
  ['next 하위 경로 import', "import { useRouter } from 'next/navigation';"],
  ['react import', "import { useState } from 'react';"],
  ['react-dom import', "import { createPortal } from 'react-dom';"],
  ['react-native import', "import { Platform } from 'react-native';"],
  ['expo import', "import { router } from 'expo-router';"],
  ['node: builtin import', "import { readFileSync } from 'node:fs';"],
  ['접두사 없는 node builtin import', "import { readFileSync } from 'fs';"],
  ['Web alias import', "import { ProfileScreen } from '@/screens/profile';"],
  ['허용 목록 밖 package import', "import { format } from 'date-fns';"],
  ['자기 package 공개 경로 import', "import { collegeCodeSchema } from '@repo/shared/college';"],
  // 문법마다 대표 family 하나
  ['type-only import', "import type { FC } from 'react';"],
  ['inline type import', "import { type FC } from 'react';"],
  ['re-export', "export { useState } from 'react';"],
  ['export *', "export * from 'react';"],
  ['import = require', "import React = require('react');"],
];

const forbiddenSyntax: Array<[string, string]> = [
  ['동적 import', "export const load = () => import('react');"],
  ['package 안 동적 import', "export const load = () => import('./contract.js');"],
  ['import type 표현', "export type Component = import('react').FC;"],
  ['require 호출', "export const react: unknown = require('react');"],
];

const forbiddenGlobals: Array<[string, string]> = [
  ['window', 'export const width = () => window.innerWidth;'],
  ['document', 'export const title = () => document.title;'],
  ['navigator', 'export const language = () => navigator.language;'],
  ['location', 'export const pathname = () => location.pathname;'],
  ['history', 'export const back = () => history.back();'],
  ['localStorage', "export const saved = () => localStorage.getItem('draft');"],
  ['sessionStorage', "export const draft = () => sessionStorage.getItem('draft');"],
  ['indexedDB', "export const open = () => indexedDB.open('cache');"],
  ['globalThis', 'export const host = () => globalThis.window;'],
  ['self', 'export const origin = () => self.origin;'],
  ['process.env', 'export const mode = () => process.env.NODE_ENV;'],
];

describe('shared renderer 중립 경계', { timeout: 60_000 }, () => {
  it.each(forbiddenImports)('%s를 막는다', async (_, source) => {
    const messages = await lint(fixtureFile, [source]);

    expect(errorLines(messages, 'no-restricted-imports')).toEqual([1]);
    expect(
      messages.find((message) => message.ruleId === 'no-restricted-imports')?.message,
    ).toContain(screensReadme);
  });

  it.each(forbiddenSyntax)('%s 문법을 막는다', async (_, source) => {
    const messages = await lint(fixtureFile, [source]);

    expect(errorLines(messages, 'no-restricted-syntax')).toEqual([1]);
    expect(
      messages.find((message) => message.ruleId === 'no-restricted-syntax')?.message,
    ).toContain(screensReadme);
  });

  it.each(forbiddenGlobals)('%s 전역을 막는다', async (_, source) => {
    const messages = await lint(fixtureFile, [source]);

    expect(errorLines(messages, 'no-restricted-globals')).toEqual([1]);
    expect(
      messages.find((message) => message.ruleId === 'no-restricted-globals')?.message,
    ).toContain(screensReadme);
  });

  it('package 안 상대 경로·zod·같은 이름의 지역 변수는 통과한다', async () => {
    const messages = await lint(fixtureFile, [
      "import { z } from 'zod';",
      "import { LegalDocumentKind } from './contract.js';",
      "import type { CollegeCode } from '../college/index.js';",
      'export const kindOf = (document: { kind: string }) => document.kind;',
      "export const query = new URLSearchParams('page=1');",
      'export const used = [z, LegalDocumentKind] as const;',
      'export type Used = CollegeCode;',
    ]);

    expect(boundaryErrors(messages)).toEqual([]);
  });

  it('test 파일은 경계 규칙을 받지 않는다', async () => {
    for (const file of [
      'test/architecture/case.spec.ts',
      'src/legal/contract.spec.ts',
      'src/legal/__tests__/contract.ts',
    ]) {
      const messages = await lint(file, [
        "import { readFileSync } from 'node:fs';",
        "export const read = () => readFileSync('package.json', 'utf8');",
        'export const cwd = () => process.cwd();',
      ]);

      expect([file, boundaryErrors(messages)]).toEqual([file, []]);
    }
  });

  it('src 파일의 effective config가 세 규칙을 error로 갖고 test 파일은 갖지 않는다', async () => {
    for (const ruleId of boundaryRuleIds) {
      expect([ruleId, await severityOf('src/legal/contract.ts', ruleId)]).toEqual([ruleId, 2]);
      expect([ruleId, await severityOf(fixtureFile, ruleId)]).toEqual([ruleId, 2]);
      expect([
        ruleId,
        await severityOf('test/architecture/public-export-surface.spec.ts', ruleId),
      ]).toEqual([ruleId, undefined]);
    }
  });

  it('실제 src 파일에 경계 위반이 없다', async () => {
    const results = await untypedLinter.lintFiles(['src/**/*.ts']);
    const violations = results.flatMap((result) =>
      boundaryErrors(result.messages).map(
        (message) =>
          `${path.relative(packageRoot, result.filePath)}:${message.line} ${message.ruleId}`,
      ),
    );

    expect(results.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
});
