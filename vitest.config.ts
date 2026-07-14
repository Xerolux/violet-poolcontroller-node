import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 90,
        lines: 80,
      },
    },
    testTimeout: 10_000,
  },
});
