import js from '@eslint/js';
import globals from 'globals';

const noElseRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer guard clauses over else blocks',
    },
    schema: [],
    messages: {
      noElse: 'No else statements are allowed',
    },
  },
  create(context) {
    return {
      IfStatement(node) {
        if (node.alternate) {
          context.report({
            node: node.alternate,
            messageId: 'noElse',
          });
        }
      },
    };
  },
};

/**
 * Determine the return value type for a given return statement argument.
 *
 * @param {import('estree').Expression | null} argument - The return argument to evaluate.
 * @returns {string | null} The inferred return type, or null when the type cannot be determined statically.
 */
const getReturnType = (argument) => {
  if (!argument) {
    return 'undefined';
  }

  if (argument.type === 'Literal') {
    if (argument.value === null) {
      return 'null';
    }

    return typeof argument.value;
  }

  if (argument.type === 'TemplateLiteral') {
    return 'string';
  }

  if (argument.type === 'ArrayExpression') {
    return 'array';
  }

  if (argument.type === 'ObjectExpression') {
    return 'object';
  }

  if (argument.type === 'ArrowFunctionExpression' || argument.type === 'FunctionExpression') {
    return 'function';
  }

  if (argument.type === 'UnaryExpression' && argument.operator === 'void') {
    return 'undefined';
  }

  return null;
};

const singleReturnTypeRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require functions to return a single consistent type',
    },
    schema: [],
    messages: {
      singleReturnType: 'Function must return a single type. Found multiple: {{types}}',
    },
  },
  create(context) {
    const functionStack = [];

    /**
     * Track entry into a function so return types can be collected.
     *
     * @returns {void}
     */
    const enterFunction = () => {
      functionStack.push({ returnTypes: new Set() });
    };

    /**
     * Validate collected return types for the function being exited.
     *
     * @param {import('estree').Function} node - The function node leaving traversal.
     * @returns {void}
     */
    const exitFunction = (node) => {
      const { returnTypes } = functionStack.pop();

      if (returnTypes.size > 1) {
        context.report({
          node,
          messageId: 'singleReturnType',
          data: { types: [...returnTypes].sort().join(', ') },
        });
      }
    };

    return {
      FunctionDeclaration: enterFunction,
      'FunctionDeclaration:exit': exitFunction,
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': exitFunction,
      ArrowFunctionExpression: enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,
      ReturnStatement(node) {
        const currentFunction = functionStack[functionStack.length - 1];

        if (!currentFunction) {
          return;
        }

        const returnType = getReturnType(node.argument);

        if (returnType) {
          currentFunction.returnTypes.add(returnType);
        }
      },
    };
  },
};

const testFiles = [
  'test/**/*.js',
  'index.test.js',
  'mcp.test.js',
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      'vendor/**',
      'server/**',
      'server/ui/**',
      'docs/**',
      'environments/**',
      'cypress/**',
      'playwright.config.ts',
      'playwright-report/**',
      'package-lock.json',
      'Dockerfile',
      'deploy.bat',
    ],
  },
  {
    files: testFiles,
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2024,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: {
          importAssertions: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.browser,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      'no-else': {
        rules: {
          'no-else': noElseRule,
        },
      },
      'return-type': {
        rules: {
          'single-return-type': singleReturnTypeRule,
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-await-in-loop': 'off',
      'no-else/no-else': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'return-type/single-return-type': 'error',
      quotes: ['error', 'single', { allowTemplateLiterals: true, avoidEscape: true }],
      semi: ['error', 'always'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'space-before-blocks': ['error', 'always'],
      'keyword-spacing': ['error', { before: true, after: true }],
      'comma-dangle': ['error', 'only-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
      'prefer-template': 'error',
    },
  },
];
