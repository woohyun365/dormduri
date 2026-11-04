// Formats every staged file Prettier has a parser for, the same scope as the CI formatting check
// (scripts/ci/lanes/check-formatting.mjs runs `prettier -c --ignore-unknown` on changed files).
// --ignore-unknown skips files without a parser; .prettierignore still excludes its paths.
export default {
  '*': ['prettier -w --ignore-unknown'],
};
