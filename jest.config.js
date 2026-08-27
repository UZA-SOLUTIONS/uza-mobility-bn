/**
 * Jest configuration for the UZA Mobility platform.
 *
 * ── STATE: THE SUITE DOES NOT RUN. Read this before touching it. ─────────────────────────
 *
 * The failure is a genuine version incompatibility between the installed jest (^30.4.2) and
 * ts-jest (29.4.12). It is not a missing dependency and not a path problem. Diagnosed
 * 27 August 2026, written down here so nobody repeats the two hours.
 *
 * WHAT JEST SAYS
 *     Module …/ts-jest/dist/index.js in the transform option was not found
 *
 * Misleading twice over. ts-jest IS installed — 29.4.12, verified. The file IS present, and
 * `require.resolve` finds it. Jest emits "was not found" when a transform module fails to
 * satisfy the transformer interface, which is a different problem wearing the same message.
 *
 * WHAT IS ACTUALLY WRONG
 * jest 30 loads a transform with CommonJS `require` and expects `createTransformer` on the
 * module object itself. Every entry point ts-jest 29.4.12 ships exposes it one level down,
 * under `.default`, because the package is built as ESM. Verified against all of these:
 *
 *     ts-jest                                     createTransformer only under .default
 *     ts-jest/legacy                              only under .default
 *     ts-jest/dist/legacy/index.js                only under .default
 *     ts-jest/preprocessor.js                     only under .default
 *     ts-jest/dist/legacy/ts-jest-transformer.js  neither
 *
 * A local adapter re-exporting `.default` at the top level was written and tested — it does
 * expose `createTransformer` as a function, and jest still refused it. So the interop gap is
 * not the only difference between what ts-jest 29.4 provides and what jest 30 expects, and
 * patching around it locally is the wrong repair.
 *
 * THE FIX — one of these. Each needs a working network connection to install, which is why it
 * is not already done.
 *
 *   1. `npm i -D ts-jest@latest`, then check its peer range actually covers jest 30.
 *   2. `npm i -D jest@29 @types/jest@29`, matching the ts-jest already installed.
 *   3. Move to `@swc/jest`, and drop ts-jest:
 *        npm i -D @swc/jest
 *        transform: { '^.+\\.(t|j)s$': '@swc/jest' }
 *
 * **Option 3 is the recommendation.** It is far faster on a codebase this size, and it skips
 * type-checking during tests — which costs nothing here, because `tsc --noEmit` runs
 * separately and passes clean.
 *
 * ── WHAT IS ALREADY FIXED ────────────────────────────────────────────────────────────────
 *
 * This config used to live in package.json with `rootDir: "src"`. That was a second and
 * separate bug: jest resolves a bare transform name relative to rootDir, and there is no
 * node_modules inside src. rootDir is now the project root, the test pattern is scoped to src
 * instead, and the `jest` block has been removed from package.json so there is one source of
 * truth rather than two that can disagree.
 *
 * Fix the version mismatch above and this file should work as it stands.
 */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // The suite reaches Postgres in places; 5s is not enough for a cold connection.
  testTimeout: 30_000,
};
