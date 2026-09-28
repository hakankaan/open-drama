import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Next's shared config (parser, React and Next rules) applies to the web app only.
const WEB_FILES = ['apps/web/**/*.{ts,tsx,js,jsx,mjs}'];
const web = (configs) => configs.map((config) => (config.ignores && !config.files ? config : { ...config, files: WEB_FILES }));

export default tseslint.config(
  {
    ignores: ['.claude/**', '**/node_modules/**', '**/dist/**', '**/.next/**', 'data/**', '.dkk/**', 'apps/api/drizzle/**', '**/next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  ...web(nextVitals),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: 'apps/web/' }, react: { version: '19' } },
    // App Router only: there is no pages directory.
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
);
