// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      /*
       * `any` is an error, not a preference.
       *
       * This was `off`. Turning it on costs nothing today because `src/` contains
       * zero `any` annotations — so the rule does not create work, it stops the
       * first one arriving unnoticed. Where a value genuinely is unknown (a JWT
       * payload, a websocket handshake) the answer is `unknown` plus a narrowing
       * check, which is what those call sites now do.
       */
      '@typescript-eslint/no-explicit-any': 'error',

      /*
       * A floating promise in a NestJS service is a silent failure: the request
       * returns 200, the write never lands, and nothing is logged. That is a bug
       * class rather than a style question, so it fails the build.
       */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      /*
       * The leading underscore is this codebase's "deliberately discarded" marker,
       * used to strip internal fields before a record leaves the API:
       *
       *   const { adminNotes: _adminNotes, ...publicListing } = listing;
       *
       * That is the right way to write it — the omission is visible where it
       * happens and the compiler enforces the rest. Without this configuration the
       * linter flagged twelve of them as unused variables, which pressures the next
       * developer to "fix" a safety pattern by deleting it.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // A spec may construct a deliberately malformed input to prove the code rejects
    // it, and the compiler cannot always follow that. Narrow exemption, tests only.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
