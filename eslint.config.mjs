import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  // Temporär: Nur Basis-ESLint ohne Next.js-spezifische Regeln
  ...compat.extends('eslint:recommended'),
  // ...compat.extends('next/core-web-vitals'),  // Auskommentiert bis Next 16 Support
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: ['node_modules/', '.next/', 'out/', 'build/'],
  },
];

export default eslintConfig;
