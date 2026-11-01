// 結合テストと同じ VS Code（1.141.0 と stable）で、Webview の動画・音声の再生を確かめる
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "../../vscode/node_modules/@vscode/test-electron/out/index.js";
import { TEST_VSCODE_VERSIONS } from "../../vscode/tests/integration/run.ts";

const outDir = join(import.meta.dirname, "results");
for (const version of TEST_VSCODE_VERSIONS) {
  const userDataDir = await mkdtemp(join(tmpdir(), "mdmark-poc-user-"));
  await runTests({
    version,
    extensionDevelopmentPath: import.meta.dirname,
    extensionTestsPath: join(import.meta.dirname, "test.cjs"),
    // 自動再生の制限で止まった play() は、Xvfb の画面へのクリック（clicker.py）の中で再生し直す
    launchArgs: ["--disable-extensions", `--user-data-dir=${userDataDir}`],
    extensionTestsEnv: { POC_OUT_DIR: outDir },
  });
}
for (const file of await readdir(outDir)) {
  const report = JSON.parse(await readFile(join(outDir, file), "utf8"));
  console.log(
    `VS Code ${report.vscode} / Electron ${report.electron} / Chrome ${report.chrome}`,
  );
  console.table(report.results);
}
