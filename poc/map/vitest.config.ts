import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["poc/map/**/*.test.ts"], environment: "node" },
});
