module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended',
  'plugin:@typescript-eslint/recommended-requiring-type-checking',],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    parser: '@typescript-eslint/parser',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  root: true,
  rules: {
    "semi": [2, "always"],
    "no-console": 2
  }
};