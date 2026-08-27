/**
 * Jest configuration for the UZA Mobility platform.
 *
 * ── STATE: THE SUITE DOES NOT RUN. Read this before touching it. ─────────────────────────
 *
 * WHAT JEST SAYS
 *     Module @swc/jest in the transform option was not found
 *
 * The message is wrong in a specific and misleading way. The module IS installed,
 * `require.resolve` finds it, and it works correctly outside jest:
 *
 *     const {createTransformer} = require('@swc/jest');
 *     createTransformer().process('export const a: number = 1;', 'x.ts', {config:{}, cacheFS:new Map()});
 *     // -> returns compiled CommonJS. No error.
 *
 * Jest reports "not found" whenever loading a transform fails for ANY reason, so the
 * message names the wrong problem.
 *
 * WHAT IS ACTUALLY WRONG — narrowed on 27 August 2026
 *
 * Jest cannot load ANY transformer in this project. Not @swc/jest, not ts-jest, and not
 * babel-jest, which ships inside jest itself. An absolute path to a file that provably
 * exists produces the same "not found". So the fault is in jest's transform loading in
 * THIS project, and it is not specific to any transformer.
 *
 * Ruled out, each tested rather than assumed:
 *   · The transformer's interface. @swc/jest exposes createTransformer at the top level,
 *     which is exactly what jest 30 wants, and it still fails. (An earlier version of this
 *     comment blamed ts-jest's ESM interop for exposing createTransformer only under
 *     .default. That was wrong — it is a real difference, but it is not the cause, because
 *     a transformer without that difference fails identically.)
 *   · Module resolution. require.resolve finds every one of them from this directory.
 *   · A corrupted node_modules. Deleted and reinstalled with `npm ci`. No change.
 *   · Version skew across the jest packages. jest-resolve and @jest/transform sit at
 *     30.4.1 while the rest are at 30.4.2 — but 30.4.1 is the latest published version of
 *     both, so this is normal, not skew.
 *   · Blocked postinstall scripts. `npm approve-scripts` then `npm rebuild`. No change.
 *   · rootDir. This config used to live in package.json with rootDir "src", where a bare
 *     transform name cannot resolve because there is no node_modules under src. That was a
 *     genuine second bug and it IS fixed: rootDir is the project root, the test pattern is
 *     scoped to src instead, and the jest block is gone from package.json so there is one
 *     source of truth rather than two that can disagree.
 *
 * WHERE TO LOOK NEXT
 *   1. Reproduce in an empty directory with jest 30 and one trivial test. If it fails
 *      there too, the fault is the environment (Node 24 with jest 30 on Windows is the
 *      obvious suspect) and not this repository.
 *   2. If it passes there, bisect this project against it — tsconfig paths, the
 *      package.json "type" field, and any .npmrc are the things that differ.
 *   3. Vitest is the pragmatic escape. UZA Nexus already uses it, so the team would be
 *      maintaining one test runner instead of two.
 *
 * WHAT THIS DOES NOT BLOCK
 * The application builds, the production image builds, the container serves, and
 * `tsc --noEmit` passes clean. This is a gap in verification, not a broken application.
 * It should not hold up a deployment, and it should not be forgotten either.
 */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'src/.*\\.spec\\.ts$',
  // @swc/jest rather than ts-jest: far faster on a codebase this size, and it skips
  // type-checking during tests, which costs nothing because tsc --noEmit runs separately
  // and passes. Neither loads today — see above.
  transform: {
    '^.+\\.(t|j)s$': '@swc/jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // The suite reaches Postgres in places; 5s is not enough for a cold connection.
  testTimeout: 30_000,
};
