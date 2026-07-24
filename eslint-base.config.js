import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import checkFile from 'eslint-plugin-check-file';
import stylisticJs from '@stylistic/eslint-plugin-js';

export default defineConfig([
  globalIgnores(['eslint*','**/playwright-report/**']),
  {
    files: ['**/*.{js,mjs,cjs}'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      js,
      '@stylistic': stylisticJs,
      'check-file': checkFile,
    },
    extends: ['js/recommended'],
  },
  {
    rules: {
      camelcase: [
        'error',
        {
          properties: 'never',
        },
      ],
      'no-console': 'error',
      'no-else-return': 'error',
      'no-lonely-if': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'error',
      'no-var': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      yoda: 'error',
      'array-bracket-spacing': ['error', 'never'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/brace-style': [
        'error',
        '1tbs',
        {
          allowSingleLine: true,
        },
      ],
      '@stylistic/comma-spacing': [
        'error',
        {
          before: false,
          after: true,
        },
      ],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/keyword-spacing': ['error'],
      '@stylistic/max-statements-per-line': [
        'error',
        {
          max: 1,
        },
      ],
      '@stylistic/no-multiple-empty-lines': [
        2,
        {
          max: 1,
          maxEOF: 1,
        },
      ],
      '@stylistic/no-tabs': 'error',
      '@stylistic/no-trailing-spaces': [
        'error',
        {
          skipBlankLines: false,
          ignoreComments: false,
        },
      ],
      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            multiline: true,
            minProperties: 3,
          },
          ObjectPattern: {
            multiline: true,
            minProperties: 3,
          },
          ImportDeclaration: {
            multiline: true,
            minProperties: 3,
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 3,
          },
        },
      ],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: false,
        },
      ],
      '@stylistic/quotes': [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      '@stylistic/space-before-function-paren': [
        'error',
        {
          named: 'never',
        },
      ],
      '@stylistic/spaced-comment': 'error',
      'check-file/filename-naming-convention': [
        'error',
        {
          './**/*.js': 'KEBAB_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
    },
  },
]);
