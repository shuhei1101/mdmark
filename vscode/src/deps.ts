import type { ExtensionContext } from "vscode";
import type { Logger } from "./log.ts";

/** `globalState` に前回のバージョンを書くキー */
export const LAST_VERSION_KEY = "mdmark.lastVersion";

/** 拡張機能の処理が共通で受ける依存。`activate` が `extensionMode` と環境変数から作る */
export type ExtensionDeps = {
  /** VS Code が渡す文脈 */
  context: ExtensionContext;
  /** 配布物の配信元（末尾の `/` を持たない） */
  distBase: string;
  /** タグ一覧の最初のページの URL */
  tagsUrl: string;
  /** `ExtensionMode.Test` で動いているか */
  test: boolean;
  /** ログの出力先 */
  log: Logger;
};
