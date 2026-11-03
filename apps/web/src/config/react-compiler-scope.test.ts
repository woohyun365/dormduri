import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

import { hasUseClientDirective } from '../../react-compiler.config';

// Vitest and Storybook compile an App Router module only when it starts with 'use client' (react-compiler.config.ts).
describe('React Compiler scope: the use client directive check', () => {
  it.each([
    ["'use client';\nexport default 1;"],
    ['"use client";'],
    ["// leading comment\n'use client';"],
    ["/* block */\n'use client';"],
    ["/** JSDoc with * stars **/\n\n// line\n/* two */ 'use client';"],
    ["/*\n * multi\n * line\n */\n'use client';"],
  ])('finds the directive after whitespace and comments: %j', (source) => {
    expect(hasUseClientDirective(source)).toBe(true);
  });

  it.each([
    ["import x from 'y';\n'use client';"],
    ["/* 'use client' */ export default 1;"],
    ["// 'use client'\nexport default 1;"],
    ["/* unterminated 'use client'"],
    ['export default 1;'],
    // A block comment ends at its first `*/`, as in JavaScript. The lazy pattern before the CodeQL fix stretched a
    // comment over later code to reach a string, so these two counted as client modules.
    ["/* a */ x */ 'use client';"],
    ["/* a */ export const x = 1; /* b */ 'use client';"],
  ])('does not find a directive that is not the first statement: %j', (source) => {
    expect(hasUseClientDirective(source)).toBe(false);
  });

  // CodeQL js/redos: a lazy block-comment pattern let a run of '*//*' split into comments in exponentially many ways.
  // The check runs in a vm with a timeout so a backtracking regression fails here instead of hanging the worker.
  it('stays linear on a long run of comment-like text', () => {
    const source = `/*${'*//*'.repeat(5000)}`;
    expect(
      runInNewContext('check(source)', { check: hasUseClientDirective, source }, { timeout: 1000 }),
    ).toBe(false);
  });
});
