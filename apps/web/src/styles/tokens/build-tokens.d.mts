// Types for build-tokens.mjs, imported by its tests (apps/web has no allowJs).
export type TokenType =
  'color' | 'dimension' | 'duration' | 'cubicBezier' | 'fontFamily' | 'fontWeight' | 'number';

export interface ColorValue {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha: 1;
  hex: string;
}

export interface ResolvedToken {
  path: string;
  type: TokenType;
  value: unknown;
  extensions: Record<string, unknown>;
}

export type ResolverInput = Record<string, string>;

export const RESOLVER_FILE: string;
export const GENERATED_CSS_FILE: string;

export class TokenFormatError extends Error {}

export function collectResolverSources(
  resolver: unknown,
  input: ResolverInput,
  readRef: (ref: string) => unknown,
): unknown[];
export function resolveTokenSources(sources: readonly unknown[]): Map<string, ResolvedToken>;
export function loadTokens(dir: string, input?: ResolverInput): Map<string, ResolvedToken>;
export function buildTokenCss(dir: string): string;
export function contrastRatio(first: ColorValue, second: ColorValue): number;
