import prettierConfig from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import ts from "typescript-eslint";
import js from "@eslint/js";

const tslint = {
    name: "tseslint",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    extends: [...ts.configs.recommendedTypeChecked],
    plugins: {
        "@typescript-eslint": ts.plugin,
    },
    languageOptions: {
        parser: ts.parser,
        parserOptions: {
            project: true,
        },
    },
    rules: {
        "@typescript-eslint/no-unused-expressions": "warn",
        "@typescript-eslint/no-confusing-void-expression": "off",
        "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/no-unnecessary-type-parameters": "off",
        "@typescript-eslint/no-unnecessary-condition": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/unbound-method": "off",
        "@typescript-eslint/no-floating-promises": [
            "error",
            {
                ignoreVoid: true,
            },
        ],
        "@typescript-eslint/no-misused-promises": [
            "error",
            {
                checksVoidReturn: false,
            },
        ],
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
};

export default ts.config(
    // global ignores
    {
        ignores: ["dist/", "node_modules/", "src/pythonTypes.d.ts", "dev-dist/"],
    },

    // apply eslint to js files
    js.configs.recommended,

    // apply tslint to ts files
    tslint,

    // global variables, applies to everything
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },

    // Adding simple-import-sort to the eslint config
    {
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            "simple-import-sort/imports": [
                "warn",
                {
                    groups: [
                        // External modules
                        ["^\\w", "^@[a-z]"],
                        // Internal modules
                        ["^@/[a-z]"],
                        ["^src"],
                        ["^\\."],
                        // Styles (ending with .css, .scss, .sass, or .less)
                        // image imports might also have a media query
                        [
                            "^.+\\.(css|scss|sass|less)$",
                            "^.+\\.(jpg|jpeg|png|gif|svg)*\\?*",
                        ],
                    ],
                },
            ],
        },
    },

    // Adding react to the eslint config
    {
        plugins: {
            react,
            'react-hooks': reactHooks
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
        languageOptions: {
            ...react.configs.flat.recommended.languageOptions,
            ecmaVersion: "latest",
        },
    },

    // apply prettier
    prettierConfig,

    // apply react-refresh
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            "react-refresh": reactRefresh
        },
        rules: {
            "react-refresh/only-export-components": [
                process.env.CI ? 'off' : 'warn',
                {
                    allowConstantExport: true,
                },
            ],
        }
    },
    {
        files: ["**/*context.ts*"],
        rules: {
            "react-refresh/only-export-components": "off",
        },
    }
);
