import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "eslint.config.js", "scripts/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/prefer-regexp-exec": "off",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-control-regex": "off",
    },
  },
);
