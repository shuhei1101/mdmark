// PoC: mdmark mcp の処理を、プラグインに置く 1 つの JavaScript に束ねる（esbuild だけ束ねない）
import { build } from "esbuild";
await build({
  stdin: {
    contents: 'import { runMcp } from "./src/cli/mcp.ts"; await runMcp({ cwd: process.cwd() });',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: "plugin/server/mcp.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  banner: { js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);' },
  external: ["esbuild"],
  define: { __MDMARK_VERSION__: JSON.stringify("v0.6.0") },
  logLevel: "warning",
});
