import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest, replacing jest.
 *
 * Jest could not load ANY transformer in this project — not ts-jest, not @swc/jest, not
 * babel-jest, which ships inside jest itself. That is documented in full in jest.config.js;
 * it was never diagnosed to a root cause, and the suite therefore never ran.
 *
 * Vitest also lets the team maintain one runner: UZA Nexus already uses it, so a developer
 * moving between the two repositories writes tests the same way in both.
 *
 * unplugin-swc compiles TypeScript with the same swc the app already uses, and it is what
 * makes NestJS decorators and `emitDecoratorMetadata` work — the usual reason a Nest project
 * on vitest fails with "Cannot read properties of undefined (reading 'prototype')".
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.test.ts'],
    // The suite reaches Postgres and Mongo in places; a cold connection needs more than 5s.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One fork: these tests share a database, and parallel files would race on it.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
