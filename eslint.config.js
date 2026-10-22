// Lint mínimo: solo errores que casi siempre son fallos de verdad (claves duplicadas, código que no se alcanza,
// asignaciones a constantes, comparaciones con NaN...). No exige estilo ni marca variables sin usar.
import js from '@eslint/js';

const recommended = Object.fromEntries(Object.entries(js.configs.recommended.rules)
  .filter(([name]) => !['no-undef', 'no-unused-vars', 'no-empty', 'no-useless-escape', 'no-prototype-builtins', 'no-cond-assign', 'no-control-regex', 'no-useless-assignment', 'preserve-caught-error', 'no-irregular-whitespace'].includes(name)));

export default [
  { ignores: ['node_modules/**', 'dist/**', 'vendor/**', 'android/**', 'ios/**', 'docs/**', 'functions/node_modules/**', 'test-results/**'] },
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, rules: { ...recommended, 'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true }] } },
  { files: ['**/*.cjs', 'functions/**/*.js', 'tests/duelo-policy.cjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs' } },
];
