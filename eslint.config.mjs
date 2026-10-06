import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Existing broad data types and effect-driven UI state are migration warnings.
    // Correctness rules, including hook order, remain errors.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  { files: ['**/*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  globalIgnores([
    'node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts',
    '.reservation-test-db/**', '.acceptance-backups/**', 'test-results/**', 'playwright-report/**',
  ]),
]);
