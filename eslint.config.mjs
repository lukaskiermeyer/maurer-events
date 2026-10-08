import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'react-hooks/set-state-in-effect': 'error',
    },
  },
  { files: ['**/*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  globalIgnores([
    'node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts',
    '.reservation-test-db/**', '.acceptance-backups/**', 'test-results/**', 'playwright-report/**',
  ]),
]);
