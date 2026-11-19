import MarkdownIt from "markdown-it";
import { parse } from "yaml";
import type { CliConfig } from "../config-files.ts";
import {
  buildAliases,
  type MdmarkAlias,
  type MdmarkAliasSource,
} from "../knowledge/aliases.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import { collectMatches } from "../knowledge/matches.ts";
import { dirOf, joinPath } from "./settings.ts";

/** 照合のために索引に加える、メッセージの本文の文書の `id` と `path` */
export const MESSAGE_DOC = {
  id: "mdmark-style:message",
  path: "mdmark-style:message.md",
};

/** 集めた用語集 */
export type Glossary = {
  index: MdmarkIndex;
  documents: Record<string, string>;
  config: CliConfig;
  aliases: MdmarkAlias[];
};

/** 下線を付ける用語の出現 1 つ */
export type TermMark = {
  line: number;
  start: number;
  end: number;
  title: string;
  description: string;
  footnote: number;
};

/** 用語集を読めないときの例外 */
export class GlossaryError extends Error {
  override name = "GlossaryError";
}

/** 用語集を読み込むのに使用する `$` の機能 */
export type GlossaryEngine = {
  fs: {
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
    list: (path: string) => Promise<{ name: string; kind: string }[]>;
  };
};

const MD = new MarkdownIt({ html: true });

/** 行の中で照合から除く範囲（行内のコード・リンク・自動リンク） */
const INLINE_EXCLUDED = /`[^`]*`|!?\[[^\]]*\]\([^)]*\)|<[a-z][\w+.-]*:[^>]*>/gi;

/** YAML のファイルを読み込む。無いか読めなければ GlossaryError */
async function readYaml($: GlossaryEngine, path: string): Promise<unknown> {
  let text: string;
  try {
    text = await $.fs.read(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GlossaryError(
      `mdmark-style の用語集を読めない: ${path}（${reason}）`,
    );
  }
  try {
    return parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : "";
    throw new GlossaryError(
      `mdmark-style の用語集を読めない: ${path}（${reason}）`,
    );
  }
}

/** glob を、`**` が `/` をまたぎ、`*`・`?` がまたがない正規表現にする */
const globToRegExp = (glob: string): RegExp => {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] ?? "";
    if (char === "*" && glob[i + 1] === "*") {
      source += ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
};

/** フォルダの下のファイルを、フォルダからの相対パスで全て返却する */
async function listFiles(
  $: GlossaryEngine,
  dir: string,
  prefix = "",
): Promise<string[]> {
  const entries = await $.fs.list(prefix === "" ? dir : `${dir}/${prefix}`);
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.kind === "dir") {
      files.push(...(await listFiles($, dir, relative)));
    } else if (entry.kind === "file") {
      files.push(relative);
    }
  }
  return files;
}

/** `aliases` の行の `paths` に該当する YAML を読み込み、エイリアスを作る */
async function loadAliases(
  $: GlossaryEngine,
  options: { rows: unknown[]; configDir: string },
): Promise<MdmarkAlias[]> {
  const { rows, configDir } = options;
  const sources: MdmarkAliasSource[] = [];
  let files: string[] | undefined;
  for (const row of rows) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const { id, paths } = row as { id?: unknown; paths?: unknown };
    if (typeof id !== "string" || !Array.isArray(paths)) {
      continue;
    }
    const patterns = paths
      .filter((path): path is string => typeof path === "string")
      .map(globToRegExp);
    files ??= await listFiles($, configDir);
    for (const file of files.filter((path) =>
      patterns.some((re) => re.test(path)),
    )) {
      try {
        sources.push({
          rowId: id,
          path: file,
          data: parse(await $.fs.read(joinPath(configDir, file))),
        });
      } catch {
        // 読めないエイリアスのファイルは、用語集の照合から外して続ける
      }
    }
  }
  return buildAliases({ rows, sources }).aliases;
}

/** `glossary` の `mdmark.config.yaml` と、その `index`・`aliases` の行が指すファイル・索引の文書を、呼ばれるたびに `$.fs` で読み込む */
export async function loadGlossary(
  $: GlossaryEngine,
  options: { configPath: string },
): Promise<Glossary> {
  const { configPath } = options;
  const raw = await readYaml($, configPath);
  const config = (
    typeof raw === "object" && raw !== null ? raw : {}
  ) as CliConfig;
  const configDir = dirOf(configPath);
  if (typeof config.index !== "string") {
    throw new GlossaryError(
      `mdmark-style の用語集を読めない: ${configPath}（index がありません）`,
    );
  }
  const indexPath = joinPath(configDir, config.index);
  const index = (await readYaml($, indexPath)) as MdmarkIndex;
  const indexDir = dirOf(indexPath);
  const documents: Record<string, string> = {};
  for (const doc of index.docs ?? []) {
    try {
      documents[doc.path] = await $.fs.read(joinPath(indexDir, doc.path));
    } catch {
      // 読めない文書は、用語集の表を持たない文書として飛ばす
    }
  }
  const aliases = Array.isArray(config.aliases)
    ? await loadAliases($, { rows: config.aliases, configDir })
    : [];
  return { index, documents, config, aliases };
}

/** 見出し・表・コードの行（1 から）の集合 */
const excludedLines = (text: string): Set<number> => {
  const lines = new Set<number>();
  for (const token of MD.parse(text, {})) {
    const whole =
      token.type === "heading_open" ||
      token.type === "table_open" ||
      token.type === "fence" ||
      token.type === "code_block" ||
      token.type === "html_block";
    if (whole && token.map !== null && token.level === 0) {
      for (let line = token.map[0]; line < token.map[1]; line += 1) {
        lines.add(line + 1);
      }
    }
  }
  return lines;
};

/** 行の中で、行内のコード・リンクの範囲に入るか */
const insideInline = (options: {
  line: string;
  start: number;
  end: number;
}) => {
  for (const match of options.line.matchAll(INLINE_EXCLUDED)) {
    const from = match.index;
    if (options.start < from + match[0].length && options.end > from) {
      return true;
    }
  }
  return false;
};

/** メッセージの本文を照合し、用語ごとの最初の出現だけを、出た順の脚注の番号を付けて返却する */
export const matchTerms = (options: {
  glossary: Glossary;
  text: string;
}): TermMark[] => {
  const { glossary, text } = options;
  const matches = collectMatches({
    index: {
      ...glossary.index,
      docs: [...glossary.index.docs, { ...MESSAGE_DOC, title: MESSAGE_DOC.id }],
    },
    documents: { ...glossary.documents, [MESSAGE_DOC.path]: text },
    config: glossary.config,
    aliases: glossary.aliases,
  });
  const lines = text.split("\n");
  const excluded = excludedLines(text);
  const seen = new Set<string>();
  const marks: TermMark[] = [];
  const found = [...(matches.byDocument[MESSAGE_DOC.id] ?? [])].sort(
    (a, b) => a.line - b.line || a.start - b.start,
  );
  for (const match of found) {
    const key = `${match.kind}\0${match.id}`;
    const line = lines[match.line - 1] ?? "";
    if (
      match.kind === "doc" ||
      seen.has(key) ||
      excluded.has(match.line) ||
      insideInline({ line, start: match.start, end: match.end })
    ) {
      continue;
    }
    seen.add(key);
    marks.push({
      line: match.line,
      start: match.start,
      end: match.end,
      title: match.title,
      description: match.description ?? "",
      footnote: marks.length + 1,
    });
  }
  return marks;
};
