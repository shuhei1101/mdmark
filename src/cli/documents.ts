import { glob, readFile } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { parse } from "yaml";
import { normalizePath } from "../knowledge/paths.ts";
import type { BuildConfig, LoadedConfig } from "./config.ts";
import { CliError } from "./main.ts";

/** Markdown の拡張子 */
const MARKDOWN_EXTENSION = ".md";

/** OS の区切りを `/` にそろえる */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** `cwd` の下で `pattern` に当たり `exclude` に当たらないファイルの、`cwd` からの相対パスを `/` 区切りで返す */
async function globFiles(options: {
  cwd: string;
  pattern: string;
  exclude: string[];
}): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of glob(options.pattern, {
    cwd: options.cwd,
    exclude: options.exclude,
    withFileTypes: true,
  })) {
    if (entry.isFile()) {
      found.push(
        toPosix(relative(options.cwd, join(entry.parentPath, entry.name))),
      );
    }
  }
  return found.sort();
}

/** `build.include` の glob に当たり `build.exclude` に当たらない `.md` のパスを、glob の並び・同じ glob の中はパスの順で、重なりを除いて返す */
export async function collectBuildDocuments(
  dir: string,
  build: Pick<BuildConfig, "include" | "exclude">,
): Promise<string[]> {
  const seen = new Set<string>();
  for (const pattern of build.include) {
    const files = await globFiles({
      cwd: dir,
      pattern,
      exclude: build.exclude ?? [],
    });
    for (const file of files) {
      if (extname(file) === MARKDOWN_EXTENSION) {
        seen.add(file);
      }
    }
  }
  return [...seen];
}

/** 設定の `index` の YAML と、索引のフォルダの下の `.md`（`build.exclude` に当たらないもの）を読む。設定に `index` が無ければ `undefined` */
export async function readIndexWithDocuments(loaded: LoadedConfig): Promise<
  | {
      indexFile: string;
      indexDir: string;
      raw: unknown;
      documents: Record<string, string>;
    }
  | undefined
> {
  const index = loaded.config.index;
  if (index === undefined) {
    return undefined;
  }
  const indexPath = resolve(loaded.dir, index);
  const indexFile = toPosix(relative(loaded.dir, indexPath));
  let raw: unknown;
  try {
    raw = parse(await readFile(indexPath, "utf8"));
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new CliError(
      `索引 ${indexFile} を読めません（${reason}）。設定の index のパスを直すか、索引を置いてください。`,
    );
  }
  const indexDir = dirname(indexPath);
  // 索引のフォルダの下の文書を、設定ファイルのフォルダからの相対パスで引いてから、索引のフォルダからの相対パスにする
  const indexDirFromConfig = toPosix(relative(loaded.dir, indexDir));
  const files = await globFiles({
    cwd: loaded.dir,
    pattern:
      indexDirFromConfig === ""
        ? `**/*${MARKDOWN_EXTENSION}`
        : `${indexDirFromConfig}/**/*${MARKDOWN_EXTENSION}`,
    exclude: loaded.config.build?.exclude ?? [],
  });
  const documents: Record<string, string> = {};
  for (const file of files) {
    const key = toPosix(relative(indexDir, join(loaded.dir, file)));
    documents[key] = await readFile(join(loaded.dir, file), "utf8");
  }
  return { indexFile, indexDir, raw, documents };
}

/** 本文の最初の h1 の文字（コードブロックの中は読まない）。無ければ `undefined` */
function firstHeading(markdown: string): string | undefined {
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1].charAt(0);
      fence =
        fence === undefined ? marker : fence === marker ? undefined : fence;
      continue;
    }
    if (fence !== undefined) {
      continue;
    }
    const heading = /^ {0,3}#\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (heading?.[1]) {
      return heading[1];
    }
  }
  return undefined;
}

/** 文書の題を決める: 索引の `title`、無ければ本文の最初の h1、無ければ拡張子を落としたファイル名 */
export function documentTitle(doc: {
  path: string;
  markdown: string;
  indexTitle?: string | undefined;
}): string {
  return (
    doc.indexTitle ??
    firstHeading(doc.markdown) ??
    basename(normalizePath(doc.path), extname(doc.path))
  );
}
