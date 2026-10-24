import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Uri, window, workspace } from "vscode";
import { CONFIG_TEMPLATE, resolveConfigPath } from "./config.ts";
import type { Logger } from "./log.ts";

/** 雛形を作るかの確認のボタン */
const CREATE_LABEL = "作る";

/** 設定ファイルをエディタで開く。無ければ雛形を作るかを尋ね、「作る」を選んだときだけ、フォルダを作って雛形を書いて開く */
export async function openConfigFile(options: {
  /** `mdmark.configPath` */
  configPath: string;
  /** 基準のフォルダ */
  baseDir: string;
  /** ログの出力先 */
  log: Logger;
}): Promise<void> {
  const { configPath, baseDir, log } = options;
  const path = resolveConfigPath({ configPath, baseDir });
  const uri = Uri.file(path);
  const exists = await workspace.fs.stat(uri).then(
    () => true,
    () => false,
  );
  if (exists) {
    await window.showTextDocument(uri);
    return;
  }
  const choice = await window.showInformationMessage(
    `${configPath} がありません。雛形を作りますか？`,
    {
      modal: true,
      detail:
        "features と libraries の書き方をコメントで添えたファイルを作ります。作った直後は、プレビューの見た目は変わりません。",
    },
    CREATE_LABEL,
  );
  if (choice !== CREATE_LABEL) {
    return;
  }
  try {
    await mkdir(dirname(path), { recursive: true });
    // 確認の間にファイルができていたら、書き換えずに開く
    await writeFile(path, CONFIG_TEMPLATE, { encoding: "utf8", flag: "wx" });
    log.info("設定ファイルの雛形を作った", path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      const reason = error instanceof Error ? error : new Error(String(error));
      log.error("設定ファイルの雛形を書けない", path, reason);
      await window.showErrorMessage(
        `設定ファイルの雛形を書けませんでした: ${path}（${reason.message}）`,
      );
      return;
    }
  }
  await window.showTextDocument(uri);
}
