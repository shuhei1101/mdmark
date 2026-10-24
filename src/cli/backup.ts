import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { CliError } from "./errors.ts";

/** 設定ファイルのあるフォルダからの写しの置き場 */
export const BACKUP_DIR = {
  root: ".mdmark",
  backups: ".mdmark/backup",
} as const;

/** 写しの置き場に置く `.gitignore` のファイル名と中身 */
const IGNORE_FILE = ".gitignore";
const IGNORE_CONTENT = "*\n";

/** 失敗の理由を 1 行の文字にする */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 時刻を手元の時刻の `yyyymmddHHMMSS` にする */
function stamp(now: Date): string {
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");
  return [
    pad(now.getFullYear(), 4),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

/** パスが在るか */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** ファイルを `.mdmark/backup/{yyyymmddHHMMSS}/` へ、設定ファイルのフォルダからの相対パスを保って写し、写しのフォルダの絶対パスを返す */
export async function takeBackup(options: {
  dir: string;
  files: string[];
  now: Date;
}): Promise<string> {
  const { dir, files, now } = options;
  // 何も書く前に、写すファイルが全て設定ファイルのフォルダの中にあることを確かめる
  for (const file of files) {
    const path = relative(dir, file);
    if (path.startsWith("..") || isAbsolute(path)) {
      throw new CliError(
        `${file} の写しを取れません（設定ファイルのフォルダの外にあります）。何も書き換えていません。`,
      );
    }
  }
  try {
    const backups = join(dir, BACKUP_DIR.backups);
    await mkdir(backups, { recursive: true });
    await writeFile(join(dir, BACKUP_DIR.root, IGNORE_FILE), IGNORE_CONTENT);
    // 同じ日時の写しがあれば末尾に -2・-3 を付ける
    let backupDir = join(backups, stamp(now));
    for (let count = 2; await exists(backupDir); count += 1) {
      backupDir = join(backups, `${stamp(now)}-${count}`);
    }
    await mkdir(backupDir);
    for (const file of files) {
      const target = join(backupDir, relative(dir, file));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }
    return backupDir;
  } catch (error) {
    throw new CliError(
      `${dir} の写しを取れません（${reasonOf(error)}）。何も書き換えていません。`,
    );
  }
}

/** 写しの全てのファイルを元の場所へ書き戻す */
export async function restoreBackup(options: {
  dir: string;
  backupDir: string;
}): Promise<void> {
  const entries = await readdir(options.backupDir, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const source = join(entry.parentPath, entry.name);
    const target = join(options.dir, relative(options.backupDir, source));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}
