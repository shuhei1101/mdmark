import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Uri, window, workspace } from "vscode";
import {
  CONFIG_FILE,
  displayConfigPath,
  findConfigChain,
} from "../../src/config-files.ts";
import { CONFIG_TEMPLATE, isFile, resolveConfigPath } from "./config.ts";
import type { Logger } from "./log.ts";

/** 雛形を作るかの確認のボタン */
const CREATE_LABEL = "作成";

/** 開くファイル（無ければ最も近い設定ファイル）をエディタで開く。無ければ雛形を作るかを尋ね、「作成」を選んだときだけ、フォルダを作って雛形を書き込んで開く */
export async function openConfigFile(options: {
  /** 開くファイル（帯から呼んだときは帯に出したファイル） */
  path?: string | undefined;
  /** Markdown のフォルダ */
  cwd: string;
  /** `mdmark.configPath` */
  configPath: string;
  /** 基準のフォルダ */
  baseDir: string;
  /** ログの出力先 */
  log: Logger;
}): Promise<void> {
  const { configPath, baseDir, log } = options;
  const path =
    options.path ??
    (configPath !== ""
      ? resolveConfigPath({ configPath, baseDir })
      : ((
          await findConfigChain({
            cwd: options.cwd,
            cascade: false,
            isFile,
          })
        )[0] ?? join(baseDir, CONFIG_FILE)));
  const shown = displayConfigPath({ path, base: baseDir, home: homedir() });
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
    `${shown} がありません。雛形を作りますか？`,
    {
      modal: true,
      detail:
        "features・libraries・theme・extensions の記載方法をコメントで添えたファイルを作ります。作った直後は、プレビューの外観は変わりません。",
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
      log.error("設定ファイルの雛形を書き込めない", path, reason);
      await window.showErrorMessage(
        `設定ファイルの雛形を書き込めませんでした: ${path}（${reason.message}）`,
      );
      return;
    }
  }
  await window.showTextDocument(uri);
}
