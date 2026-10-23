import { readdir } from "node:fs/promises";
import { join } from "node:path";
import Mocha from "mocha";

/** 拡張機能ホストの中で `out/test/` の `*.test.mjs` を mocha で走らせ、落ちた数が 1 以上なら reject する */
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", timeout: 20000 });
  const directory = import.meta.dirname;
  // 読む順を決める（`00-` で始まるファイルは、前回のバージョンが空の状態で流す）
  for (const name of (await readdir(directory)).sort()) {
    if (name.endsWith(".test.mjs")) {
      mocha.addFile(join(directory, name));
    }
  }
  await mocha.loadFilesAsync();
  const failures = await new Promise<number>((resolve) => {
    mocha.run(resolve);
  });
  if (failures > 0) {
    throw new Error(`${failures} tests failed`);
  }
}
