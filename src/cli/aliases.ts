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

/** 設定の `aliases` の行の `paths` を設定ファイルのフォルダから引いて YAML を読み、`buildAliases` に渡して、エイリアスとずれを返す。設定に `aliases` が無ければファイルを読まず `undefined` を返す */
export async function loadAliases(loaded: LoadedConfig): Promise<{
  aliases: MdmarkAlias[] | undefined;
  issues: CheckIssue[];
}> {
  const rows = loaded.config.aliases;
  if (rows === undefined) {
    return { aliases: undefined, issues: [] };
  }
  const configName = basename(loaded.path);
  const readIssues: CheckIssue[] = [];
  const sources: MdmarkAliasSource[] = [];
  const rowIds = new Set<string>();
  for (const [position, row] of rows.entries()) {
    // 読まない行と、`buildAliases` が使わない行・前の行と同じ `id` の行は、ファイルも読まない
    if (
      !isRecord(row) ||
      row.enabled === false ||
      typeof row.id !== "string" ||
      row.id === "" ||
      !Array.isArray(row.paths) ||
      rowIds.has(row.id)
    ) {
      continue;
    }
    rowIds.add(row.id);
    const patterns = row.paths.filter(
      (path): path is string => typeof path === "string",
    );
    const files: string[] = [];
    for (const pattern of patterns) {
      for (const file of await globFiles({
        cwd: loaded.dir,
        pattern,
        exclude: [],
      })) {
        if (!files.includes(file)) {
          files.push(file);
        }
      }
    }
    if (files.length === 0) {
      readIssues.push({
        file: configName,
        where: `aliases[${position}].paths`,
        kind: "alias_no_files",
        message: `\`${patterns.join("`・`")}\` に当たるファイルがありません。\`paths\` を直してください。`,
      });
      continue;
    }
    for (const file of files) {
      try {
        const data: unknown = parse(
          await readFile(join(loaded.dir, file), "utf8"),
        );
        sources.push({ rowId: row.id, path: file, data });
      } catch (error) {
        if (!(error instanceof YAMLParseError)) {
          throw error;
        }
        const line = error.linePos?.[0].line;
        const reason = error.message.split("\n")[0] ?? "";
        readIssues.push({
          file,
          where: "",
          kind: "alias_unreadable",
          message: `${line ?? "?"} 行目を YAML として読めません（${reason}）。字下げと書き方を直してください。`,
        });
      }
    }
  }
  const built = buildAliases({ rows, sources, configFile: configName });
  return { aliases: built.aliases, issues: [...readIssues, ...built.problems] };
}
