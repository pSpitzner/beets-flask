module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended-type-checked",
        "plugin:@typescript-eslint/stylistic-type-checked",
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:@tanstack/eslint-plugin-query/recommended",
    ],
    ignorePatterns: [
        "dist",
        ".eslintrc.cjs",
        "tailwind.config.js",
        "postcss.config.js",
        "vite.config.ts",
        "*.md",
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["react-refresh", "simple-import-sort"],
    rules: {
        "react-refresh/only-export-components": [0],
        "@typescript-eslint/no-empty-function": "off",
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
                    ["^.+\\.(css|scss|sass|less)$", "^.+\\.(jpg|jpeg|png|gif|svg)*\\?*"],
                ],
            },
        ],
    },
    settings: {
        react: {
            version: "18.2",
        },
    },
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
    },
};
