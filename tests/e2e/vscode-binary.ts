import { createRequire } from "node:module";
import { join, resolve } from "node:path";

// 拡張機能の場所（`@vscode/test-electron` の置き場所とキャッシュの親）
const EXTENSION_SOURCE = resolve(import.meta.dirname, "../../vscode");

/** 流す VS Code のバージョン（拡張機能が対応する下限） */
export const VSCODE_VERSION = "1.141.0";
/** 取得した VS Code を置くキャッシュの場所 */
export const VSCODE_CACHE_PATH = join(EXTENSION_SOURCE, ".vscode-test");
/** 取得した VS Code の実行ファイルの場所を、`globalSetup` からワーカーへ渡す環境変数の名前 */
export const VSCODE_EXECUTABLE_ENV = "MDMARK_E2E_VSCODE_EXECUTABLE";

/** `@vscode/test-electron` で VS Code を取得し、実行ファイルの場所を返す */
export async function downloadVscode(): Promise<string> {
  const require = createRequire(join(EXTENSION_SOURCE, "package.json"));
  const { downloadAndUnzipVSCode } = require("@vscode/test-electron");
  return downloadAndUnzipVSCode({
    version: VSCODE_VERSION,
    cachePath: VSCODE_CACHE_PATH,
  });
}
