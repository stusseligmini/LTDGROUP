/**
 * ESLint 9 Flat Config
 * Migrated from legacy config. Uses @eslint/js for base recommended rules
 * and FlatCompat to consume shareable configs (next/core-web-vitals, prettier, etc.).
 */

const path = require('path');
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  {
    ignores: [
      'node_modules/**', 
      '.next/**', 
      'public/**', 
      'dist/**',
      'tailwind.config.ts',
      'postcss.config.js',
      'next.config.js',
      'workbox-config.js',
      'jest.setup.ts',
      'jest.config.js',
      'ci/**',
      'extension/**',
      'eslint.config.js',
      'functions/**',
      'mobile/**',
      'packages/**',
      'prisma/**',
      'scripts/**',
      'tests/**',
      'src/**/__tests__/**',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'playwright.config.ts',
      'sentry.*.config.ts',
      'next-env.d.ts'
    ],
  },
  // Base JS recommended
  js.configs.recommended,
  // Shareable configs via compat (exclude eslint:recommended because js.configs.recommended replaces it)
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'next',
    'next/core-web-vitals',
    'plugin:react-hooks/recommended',
    'prettier'
  ),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: path.join(__dirname, 'tsconfig.json'),
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-case-declarations': 'error',
    },
  },
];