import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** フォルダが無ければ作り、同じフォルダの `.{名前}.{乱数}.tmp` に書いてから `rename` で置き換える。失敗したら一時ファイルを消して投げ直す */
export async function writeFileAtomically(options: {
  /** 書き出す先 */
  path: string;
  /** 中身 */
  content: string;
}): Promise<void> {
  const { path, content } = options;
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = join(
    directory,
    `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
