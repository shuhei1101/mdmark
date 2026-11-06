import * as assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { api } from "./helpers.ts";

/** PoC: esbuild-wasm を拡張機能ホストの中で動かし、時間とメモリを記録する */
suite("PoC: esbuild-wasm", () => {
  test("拡張機能ホストで .ts の拡張を束ね、Webview で import する", async () => {
    const testApi = await api();
    const directory = await mkdtemp(join(tmpdir(), "mdmark-poc-"));
    await mkdir(join(directory, "lib"));
    await writeFile(
      join(directory, "lib", "util.ts"),
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 書き出す TypeScript のテンプレート文字列
      "export const label = (value: string): string => `poc-${value}`;\n",
    );
    await writeFile(
      join(directory, "entry.ts"),
      [
        'import { nanoid } from "https://cdn.jsdelivr.net/npm/nanoid@5.0.9/index.browser.js";',
        'import { label } from "./lib/util.ts";',
        "type Extension = { name: string; marker: () => string };",
        'const extension: Extension = { name: "poc", marker: () => label(String(nanoid(4).length)) };',
        "export default extension;",
        "",
      ].join("\n"),
    );
    const entry = join(directory, "entry.ts");
    const hasSelf = "self" in globalThis;
    const started = performance.now();
    const first = await testApi.pocBundle(entry);
    const firstMs = performance.now() - started;
    const repeatMs: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const begin = performance.now();
      await testApi.pocBundle(entry);
      repeatMs.push(performance.now() - begin);
    }
    const rssBefore = process.memoryUsage().rss;
    for (let index = 0; index < 20; index += 1) {
      await testApi.pocBundle(entry);
    }
    const rssAfter20 = process.memoryUsage().rss;
    await testApi.pocStop();
    globalThis.gc?.();
    const restart = performance.now();
    await testApi.pocBundle(entry);
    const restartMs = performance.now() - restart;
    const rssAfterRestart = process.memoryUsage().rss;
    const imported = await testApi.pocImport(first);
    const result = {
      selfBefore: hasSelf,
      selfAfter: "self" in globalThis,
      firstMs,
      repeatMs,
      restartMs,
      rssBefore,
      rssAfter20,
      rssAfterRestart,
      bytes: first.length,
      imported,
    };
    console.log(`POC_RESULT ${JSON.stringify(result)}`);
    assert.equal(imported, "poc:poc-4");
  });
});
