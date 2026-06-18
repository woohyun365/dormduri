// @ts-check
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

import base from './base.mjs';

/** @type {import('eslint').Linter.Config[]} */
const next = [...nextVitals, ...nextTs, ...base, prettier];

export default next;
