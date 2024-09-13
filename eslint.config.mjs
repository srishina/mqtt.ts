import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/dist/", "**/dist.browser/", "**/dist.browser.demo/", "eslint.config.mjs"],
}, ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
    },

    rules: {
        semi: [2, "always"],

        "no-multiple-empty-lines": ["error", {
            max: 1,
            maxBOF: 0,
            maxEOF: 0,
        }],

        "no-trailing-spaces": ["error", {
            skipBlankLines: true,
        }],

        "@typescript-eslint/no-namespace": "off",
        "consistent-this": [2, "self"],

        "@typescript-eslint/no-this-alias": ["error", {
            allowedNames: ["self"],
        }],

        "arrow-body-style": ["error", "as-needed"],

        "@typescript-eslint/consistent-type-imports": ["error", {
            prefer: "type-imports",
        }],

        quotes: [2, "single", {
            avoidEscape: true,
        }],
    },
}];