// server/ui/.eslintrc.js
export default {
  root: true,
  env: {
    browser: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: ["no-else"],
  rules: {
    // Crockford-style strictness
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
    "no-eval": "error",
    "no-with": "error",
    "no-undef": "error",
    "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
    "no-extend-native": "error",
    "no-new-func": "error",
    "no-implied-eval": "error",
    "no-alert": "warn",

    // Crockford dislikes ++ and --
    "no-plusplus": ["error", { allowForLoopAfterthoughts: false }],

    // Crockford prefers single quotes
    quotes: ["error", "single"],

    // Always use semicolons
    semi: ["error", "always"],

    // Avoid ambiguity
    "no-bitwise": "error",
    "no-lonely-if": "error",
    "no-nested-ternary": "error",
    "no-else-return": ["error", { allowElseIf: false }],
    "no-else/no-else": "error", //  Disallow all `else` this is extremly important for completely stopping bugs.

    // Spacing and clarity
    indent: ["error", 2],
    "space-before-blocks": ["error", "always"],
    "keyword-spacing": ["error", { before: true, after: true }],
    "comma-dangle": ["error", "never"],
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],

    // Optional but stylistically aligned
    "no-var": "error",
    "prefer-const": "error",
    "prefer-template": "error",
  },
};
