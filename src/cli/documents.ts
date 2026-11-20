import { glob, readFile } from "node:fs/promises";
import {
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { parse } from "yaml";
import { splitFrontmatter } from "../frontmatter/frontmatter.logic.ts";
import { resolveDocTitle } from "../knowledge/references.ts";
import type { BuildConfig, LoadedConfig } from "./config.ts";
import { CliError } from "./errors.ts";

/** Markdown の拡張子 */
const MARKDOWN_EXTENSION = ".md";

/** OS の区切りを `/` にそろえる */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** `cwd` の下で `pattern` に該当し `exclude` に該当しないファイルの、`cwd` からの相対パスを `/` 区切りで返却する */
export async function globFiles(options: {
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

/** `build.include` の glob に該当し `build.exclude` に該当しない `.md` のパスを、glob の並び・同じ glob の中はパスの順で、重なりを除いて返却する */
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

/** 設定の `index` の YAML と、索引のフォルダの下の `.md`（`build.exclude` に該当しないもの）を読み込む。設定に `index` が無ければ `undefined` */
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
      `索引 ${indexFile} を読み込めません（${reason}）。設定の index のパスを修正するか、索引を配置してください。`,
    );
  }
  const indexDir = dirname(indexPath);
  // 索引のフォルダの下の文書を、設定ファイルのフォルダからの相対パスで参照してから、索引のフォルダからの相対パスにする
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

/** 文書のタイトルを決める: `resolveDocTitle` に委ね、索引の `title`、無ければフロントマターの `title`、無ければ本文の最初の h1 の文字、無ければ拡張子を落としたファイル名 */
export function documentTitle(doc: {
  path: string;
  markdown: string;
  indexTitle?: string | undefined;
  frontmatterTitle?: string | undefined;
}): string {
  return resolveDocTitle(doc);
}

/** 各文書の先頭のフロントマターの中身を YAML として解析した値の表。フロントマターを持たない文書と、解析できない文書は入れない */
export function readFrontmatterValues(
  markdowns: Record<string, string>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [path, markdown] of Object.entries(markdowns)) {
    const { content } = splitFrontmatter(markdown);
    if (content === undefined) {
      continue;
    }
    try {
      values[path] = parse(content);
    } catch {
      // 解析できないフロントマターは、無いものとして扱う
    }
  }
  return values;
}
