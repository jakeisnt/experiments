module.exports = {
  parser: "@typescript-eslint/parser",

  env: {
    browser: true,
    es6: true,
    node: true,
  },

  plugins: ["import"],

  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "prettier/@typescript-eslint",
    "hardcore",
    "hardcore/fp",
    "plugin:prettier/recommended",
  ],

  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",

    ecmaFeatures: {
      jsx: true,
    },
  },

  settings: {
    react: {
      version: "detect",
    },
  },

  rules: {
    "no-console": "error",
    "no-eval": "error",
    "import/first": "error",
    "@typescript-eslint/ban-ts-comment": 1,
    "react/jsx-no-comment-textnodes": 1,
    "react/prop-types": 1,
    "id-length": 0,
    "no-magic-numbers": 0,
    "max-statements": 0,
    "func-style": 0,
    "padding-line-between-statements": 0,
  },
}
