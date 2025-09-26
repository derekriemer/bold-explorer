// .eslintrc.cjs
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/typescript/recommended',
    'plugin:prettier/recommended', // Keep Prettier last
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Project-specific
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/no-deprecated-slot-attribute': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // === Style guide enforcement ===
    // Always require braces
    curly: ['error', 'all'],

    // Standard 1TBS: if (...) { ... } else { ... }
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'space-before-blocks': ['error', 'always'],
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/'],
};
