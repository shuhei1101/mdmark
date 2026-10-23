import { open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Document, isMap, isSeq, parseDocument, type YAMLSeq } from "yaml";
import { type IndexProblem, normalizeIndex } from "../knowledge/index-shape.ts";
import type { LoadedConfig } from "./config.ts";
import { readIndexWithDocuments } from "./documents.ts";
import { CliError } from "./errors.ts";

/** パスの区切りを `/` にする */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** 索引のパスに足してロックのファイル名にする末尾 */
const INDEX_LOCK_SUFFIX = ".lock";
/** 他の書き換えがロックを持っているときに取り直す間隔のミリ秒 */
const INDEX_LOCK_RETRY_MS = 50;
/** ロックを取れるまで待つ上限のミリ秒 */
const INDEX_LOCK_TIMEOUT_MS = 5000;
/** 設定に `index` が無いときの誤りの文 */
const INDEX_MISSING_MESSAGE =
  "設定に index がありません。index に索引のファイルのパスを書いてください。";
/** `kind` から索引の一覧のキーを引く表 */
const LIST_KEYS = { doc: "docs", term: "terms" } as const;

/** 書き換える一覧: 文書か用語 */
export type IndexKind = keyof typeof LIST_KEYS;

/** 書き換えでしたこと */
export type IndexAction = "added" | "replaced" | "removed";

/** 設定の `index` の索引と索引の文書を読む。設定に `index` が無ければ誤りにする */
export async function requireIndexWithDocuments(loaded: LoadedConfig): Promise<{
  indexFile: string;
  indexDir: string;
  raw: unknown;
  documents: Record<string, string>;
}> {
  const read = await readIndexWithDocuments(loaded);
  if (read === undefined) {
    throw new CliError(INDEX_MISSING_MESSAGE);
  }
  return read;
}

/** 索引の YAML の文書で、`docs` か `terms` の ID の要素を置き換え・末尾へ足し・消し、書き換えた後の索引を索引の形で検査する。渡した `document` を書き換える */
export function applyIndexUpdate(options: {
  /** 索引の YAML の文書 */
  document: Document;
  /** 書き換える一覧 */
  kind: IndexKind;
  /** 文書か用語の ID */
  id: string;
  /** 項目の中身。`null` は消す */
  item: Record<string, unknown> | null;
}): { action: IndexAction; problems: IndexProblem[] } {
  const { document, kind, id, item } = options;
  const key = LIST_KEYS[kind];
  const found = document.get(key, true);
  let list: YAMLSeq | undefined = isSeq(found) ? found : undefined;
  const position = list
    ? list.items.findIndex((node) => isMap(node) && node.get("id") === id)
    : -1;

  let action: IndexAction;
  if (item === null) {
    if (list === undefined || position < 0) {
      throw new CliError(
        `\`${id}\` は索引の \`${key}\` にありません。ID を確かめてください。`,
      );
    }
    list.items.splice(position, 1);
    action = "removed";
  } else {
    // 要素は `id` を先頭にした並びにし、`item` の `id` は使わない
    const { id: _ignored, ...rest } = item;
    const node = document.createNode({ id, ...rest });
    if (list === undefined) {
      list = document.createNode([]) as YAMLSeq;
      document.set(key, list);
    }
    if (position >= 0) {
      list.items[position] = node;
      action = "replaced";
    } else {
      list.items.push(node);
      action = "added";
    }
  }
  return { action, problems: normalizeIndex(document.toJS()).problems };
}

/** ロックのファイルを新しく作る。作れたら `true`、既にあれば `false` */
async function tryCreateLock(lockPath: string): Promise<boolean> {
  try {
    const handle = await open(lockPath, "wx");
    await handle.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

/** ロックを取れるまで `INDEX_LOCK_RETRY_MS` ごとに取り直し、`timeoutMs` を超えたら誤りにする */
async function acquireLock(options: {
  lockPath: string;
  display: string;
  timeoutMs: number;
}): Promise<void> {
  const { lockPath, display, timeoutMs } = options;
  const deadline = Date.now() + timeoutMs;
  while (!(await tryCreateLock(lockPath))) {
    if (Date.now() >= deadline) {
      throw new CliError(
        `索引 ${display} は書き換え中です（${display}${INDEX_LOCK_SUFFIX} があります）。少し待ってから呼び直すか、書き換え中でなければ ${display}${INDEX_LOCK_SUFFIX} を消してください。`,
      );
    }
    await sleep(INDEX_LOCK_RETRY_MS);
  }
}

/** 索引のファイルを読んで YAML の文書にする。読めなければ誤りにする */
async function readIndexDocument(
  indexPath: string,
  display: string,
): Promise<Document> {
  let reason: string;
  try {
    const document = parseDocument(await readFile(indexPath, "utf8"));
    const first = document.errors[0];
    if (first === undefined) {
      return document;
    }
    reason = first.message.split("\n")[0] ?? first.message;
  } catch (error) {
    reason =
      error instanceof Error
        ? (error.message.split("\n")[0] ?? error.message)
        : String(error);
  }
  throw new CliError(
    `索引 ${display} を読めません（${reason}）。設定の index のパスを直すか、索引を置いてください。`,
  );
}

/** ロックの中で索引のファイルを読み、項目を書き換えて検査し、合えば一時ファイルに書いてから置き換える。合わないとき・失敗したときは索引のファイルを書き換えず、一時ファイルとロックを残さない */
export async function updateIndexFile(options: {
  /** 読んだ設定 */
  loaded: LoadedConfig;
  /** 書き換える一覧 */
  kind: IndexKind;
  /** 文書か用語の ID */
  id: string;
  /** 項目の中身。`null` は消す */
  item: Record<string, unknown> | null;
  /** ロックを待つ上限のミリ秒 */
  lockTimeoutMs?: number;
}): Promise<{ action: IndexAction; index: string }> {
  const { loaded, kind, id, item } = options;
  const index = loaded.config.index;
  if (index === undefined) {
    throw new CliError(INDEX_MISSING_MESSAGE);
  }
  const indexPath = resolve(loaded.dir, index);
  const display = toPosix(relative(loaded.dir, indexPath));
  const lockPath = `${indexPath}${INDEX_LOCK_SUFFIX}`;
  await acquireLock({
    lockPath,
    display,
    timeoutMs: options.lockTimeoutMs ?? INDEX_LOCK_TIMEOUT_MS,
  });
  const tempPath = join(
    dirname(indexPath),
    `.${basename(indexPath)}.${process.pid}.tmp`,
  );
  try {
    const document = await readIndexDocument(indexPath, display);
    const { action, problems } = applyIndexUpdate({
      document,
      kind,
      id,
      item,
    });
    if (problems.length > 0) {
      const lines = problems.map(
        (problem) => `${problem.where}: ${problem.message}`,
      );
      throw new CliError(
        `書き換えた後の索引が索引の形に合いません。合わないところを直してください。\n${lines.join("\n")}`,
      );
    }
    try {
      // 既存の行の折り返しは変えない
      await writeFile(tempPath, document.toString({ lineWidth: 0 }));
      await rename(tempPath, indexPath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
    return { action, index: display };
  } finally {
    await rm(lockPath, { force: true });
  }
}
