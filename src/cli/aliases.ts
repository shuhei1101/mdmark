import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse, YAMLParseError } from "yaml";
import {
  buildAliases,
  type MdmarkAlias,
  type MdmarkAliasSource,
} from "../knowledge/aliases.ts";
import type { CheckIssue } from "./check.ts";
import type { LoadedConfig } from "./config.ts";
import { globFiles } from "./documents.ts";

/** 値がキーと値の組か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 読み込む `aliases` の行か（`enabled: false`・`id` が空・`paths` が無い・前の行と同じ `id` の行は、`buildAliases` が使用しないためファイルも読み込まない） */
function isReadRow(
  row: unknown,
  rowIds: Set<string>,
): row is Record<string, unknown> & { id: string; paths: unknown[] } {
  return (
    isRecord(row) &&
    row.enabled !== false &&
    typeof row.id === "string" &&
    row.id !== "" &&
    Array.isArray(row.paths) &&
    !rowIds.has(row.id)
  );
}

/** glob の並びに該当したファイル（重なりを除き、glob の順） */
async function filesOf(dir: string, patterns: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const pattern of patterns) {
    for (const file of await globFiles({ cwd: dir, pattern, exclude: [] })) {
      if (!files.includes(file)) {
        files.push(file);
      }
    }
  }
  return files;
}

/** YAML を読み込む。YAML として読めなければ、ずれを返却する */
async function readAliasFile(options: {
  absolute: string;
  file: string;
  rowId: string;
}): Promise<{ source: MdmarkAliasSource } | { issue: CheckIssue }> {
  const { absolute, file, rowId } = options;
  try {
    const data: unknown = parse(await readFile(absolute, "utf8"));
    return { source: { rowId, path: file, data } };
  } catch (error) {
    if (!(error instanceof YAMLParseError)) {
      throw error;
    }
    const line = error.linePos?.[0].line;
    const reason = error.message.split("\n")[0] ?? "";
    return {
      issue: {
        file,
        where: "",
        kind: "alias_unreadable",
        message: `${line ?? "?"} 行目を YAML として読み込めません（${reason}）。字下げと記載方法を修正してください。`,
      },
    };
  }
}

/** 設定の `aliases` の行の `paths` を設定ファイルのフォルダから参照して YAML を読み込み、`buildAliases` に指定して、エイリアスとずれと、該当した YAML の絶対パスを返却する。設定に `aliases` が無ければファイルを読み込まず `undefined` を返却する */
export async function loadAliases(loaded: LoadedConfig): Promise<{
  aliases: MdmarkAlias[] | undefined;
  issues: CheckIssue[];
  files: string[];
}> {
  const rows = loaded.config.aliases;
  if (rows === undefined) {
    return { aliases: undefined, issues: [], files: [] };
  }
  const configName = basename(loaded.path);
  const readIssues: CheckIssue[] = [];
  const sources: MdmarkAliasSource[] = [];
  const rowIds = new Set<string>();
  const matched = new Set<string>();
  for (const [position, row] of rows.entries()) {
    if (!isReadRow(row, rowIds)) {
      continue;
    }
    rowIds.add(row.id);
    const patterns = row.paths.filter(
      (path): path is string => typeof path === "string",
    );
    const files = await filesOf(loaded.dir, patterns);
    if (files.length === 0) {
      readIssues.push({
        file: configName,
        where: `aliases[${position}].paths`,
        kind: "alias_no_files",
        message: `\`${patterns.join("`・`")}\` に該当するファイルがありません。\`paths\` を修正してください。`,
      });
      continue;
    }
    for (const file of files) {
      const absolute = join(loaded.dir, file);
      matched.add(absolute);
      const read = await readAliasFile({ absolute, file, rowId: row.id });
      if ("source" in read) {
        sources.push(read.source);
      } else {
        readIssues.push(read.issue);
      }
    }
  }
  const built = buildAliases({ rows, sources, configFile: configName });
  return {
    aliases: built.aliases,
    issues: [...readIssues, ...built.problems],
    files: [...matched],
  };
}
