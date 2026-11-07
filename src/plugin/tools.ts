import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { buildSite } from "../cli/build.ts";
import {
  collectCheckIssues,
  importBundledCode,
  validateSourceArgs,
} from "../cli/check.ts";
import { findConfigFile } from "../cli/config.ts";
import { CliError } from "../cli/errors.ts";
import { exportDocument } from "../cli/export.ts";
import { checkMarkdownSource } from "../cli/markdown-check.ts";
import { checkArguments, type ToolInputSchema } from "./arguments.ts";

/** `mdmark serve` を起動したパッケージの直下から決める、配布物のフォルダ */
export type ServerRoots = {
  /** 書き出しに埋める配布物のフォルダ（`{パッケージの直下}/dist`） */
  distDir: string;
};

/** ツールの処理が使う、呼び出しの作業のフォルダとサーバーが読む配布物の場所 */
export type ToolContext = ServerRoots & {
  /** 引数の `project_dir`。相対パスの引数と設定ファイルの探索の基準 */
  projectDir: string;
};

/** ツールの処理が返す、JSON にする値 */
export type ToolOutput = {
  /** JSON の文字列にして 1 つのテキストで返す値 */
  json: Record<string, unknown>;
};

/** ツール 1 つの名前・説明・引数の形・処理 */
export type ToolDefinition = {
  name: "export_html" | "build_site" | "check";
  /** ツールの説明。呼ぶ場面と、引数・戻り値を日本語で書く */
  description: string;
  /** 引数の形。`tools/list` に JSON Schema として出し、引数を検査するものにも使う */
  inputSchema: ToolInputSchema;
  /** 検査を通った引数で処理し、結果を返す。利用者に見せる誤りは `CliError` を投げる */
  run: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ToolOutput>;
  /** `tools/list` に出すツールの annotations。索引と文書を書き換えないツールだけが持つ */
  annotations?: { readOnlyHint: boolean };
};

/** PreToolUse のフックが作業のフォルダの絶対パスを入れる引数の名前 */
export const PROJECT_DIR_ARG = "project_dir";

/** `project_dir` が無い・絶対パスでない・そのフォルダが無いときのツールのエラーの文 */
export const PROJECT_DIR_ERROR_MESSAGE =
  "引数 project_dir が無いか、ある作業のフォルダの絶対パスではありません。mdmark のプラグインを入れた Claude Code のセッションから呼んでください。";

/** 設定ファイルの引数の説明 */
const CONFIG_DESCRIPTION =
  "使う設定ファイルのパス。省くと、セッションのフォルダから上へ mdmark.config.yaml を探す";

/** 文書を HTML に書き出す: 作業のフォルダを基準に `mdmark export` と同じ処理で書き出し、絶対パスと警告を返す */
export async function runExportHtml(
  args: { file: string; out?: string; config?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const { out, warnings } = await exportDocument({
    cwd: context.projectDir,
    file: args.file,
    out: args.out,
    config: args.config,
    distDir: context.distDir,
  });
  return { json: { out, warnings } };
}

/** 複数の文書を 1 枚にまとめる: 作業のフォルダを基準に `mdmark build` と同じ処理でまとめ、絶対パス・文書の数・警告を返す */
export async function runBuildSite(
  args: { config?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const { out, docs, warnings } = await buildSite({
    cwd: context.projectDir,
    config: args.config,
    distDir: context.distDir,
  });
  return { json: { out, docs, warnings } };
}

/** 点検する: 作業のフォルダから設定ファイルを探し、`mdmark check` と同じずれの一覧を返す。`base` を渡すと `change_together` の直し忘れも返す。`text` か `file` と `key` を渡すと、`mdmark check --text`・`--file --key` と同じく渡した Markdown の記法だけを点検する */
export async function runCheckTool(
  args: {
    config?: string;
    base?: string;
    text?: string;
    file?: string;
    key?: string;
  },
  context: ToolContext,
): Promise<ToolOutput> {
  validateSourceArgs(args);
  if (args.text !== undefined || args.file !== undefined) {
    const issues = await checkMarkdownSource({
      cwd: context.projectDir,
      config: args.config,
      text: args.text,
      file: args.file,
      key: args.key,
      importCode: importBundledCode,
    });
    return { json: { issues } };
  }
  const path = await findConfigFile(context.projectDir, args.config);
  const issues = await collectCheckIssues(path, {
    cwd: context.projectDir,
    explicit: args.config !== undefined,
    ...(args.base === undefined ? {} : { base: args.base }),
  });
  return { json: { issues } };
}

/** 登録するツールの定義（どのツールも引数の `project_dir` を必須にし、`project_dir` は `inputSchema` に含めない） */
export const TOOLS: ToolDefinition[] = [
  {
    name: "export_html",
    description:
      "Markdown の文書を 1 つ、外へ要求しない 1 枚の HTML に書き出す（mdmark export と同じ処理）。引数 file は書き出す文書、out は書き出す HTML のパス（省くと文書と同じフォルダの .html）。書き出した HTML の絶対パス out と警告 warnings を JSON で返す。",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          minLength: 1,
          description: "書き出す Markdown のパス",
        },
        out: { type: "string", description: "書き出す HTML のパス" },
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: ["file"],
      additionalProperties: false,
    },
    run: (args, context) =>
      runExportHtml(
        args as { file: string; out?: string; config?: string },
        context,
      ),
  },
  {
    name: "build_site",
    description:
      "設定の build で決めた文書を、行き来できる 1 枚の HTML にまとめる（mdmark build と同じ処理）。書き出した HTML の絶対パス out・入れた文書の数 docs・警告 warnings を JSON で返す。",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) => runBuildSite(args as { config?: string }, context),
  },
  {
    name: "check",
    description:
      "設定の形・索引と文書のずれ・build の対象の有無・知らない印・include のマーカーの取り込み先を点検する（mdmark check と同じ処理）。設定・索引・文書は書き換えない。ずれの一覧 issues（file・where・kind・message）を JSON で返し、ずれがあってもエラーにしない。base に比べる基準の git の ref（例 origin/develop）を渡すと、基準と HEAD の merge-base から変わった文書を比べ、change_together の組のうち片方だけが変わった直し忘れも返す。text に Markdown の文字列、または file に YAML のファイルと key にキーのパスを渡すと、設定と索引は点検せず、その Markdown を描いたときの書き方の警告・知らない印・図の配置のずれだけを返す（text は file が -、file は where が YAML のファイルの行）。",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "string", description: CONFIG_DESCRIPTION },
        base: {
          type: "string",
          description:
            "直し忘れの検査に比べる基準の git の ref。省くと直し忘れを検査しない",
        },
        text: {
          type: "string",
          description:
            "点検する Markdown の文字列。base・file・key と一緒に渡せない",
        },
        file: {
          type: "string",
          minLength: 1,
          description:
            "Markdown をキーの値に持つ YAML のファイルのパス（project_dir からの相対パスか絶対パス）。key と一緒に渡す",
        },
        key: {
          type: "string",
          minLength: 1,
          description:
            "file の YAML の中で点検する文字列の値のキーのパス。. でキーを、[位置] で配列の要素をたどる（例 items[0].body）",
        },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) =>
      runCheckTool(
        args as {
          config?: string;
          base?: string;
          text?: string;
          file?: string;
          key?: string;
        },
        context,
      ),
    annotations: { readOnlyHint: true },
  },
];

/** `project_dir` の値が、あるフォルダの絶対パスか */
function isProjectDir(value: unknown): value is string {
  return (
    typeof value === "string" &&
    isAbsolute(value) &&
    statSync(value, { throwIfNoEntry: false })?.isDirectory() === true
  );
}

/** 引数を検査してツールの処理を呼び、結果か誤りを MCP のツールの結果にする。どの誤りでもサーバーを止めず、その呼び出しだけを `isError` にする */
export async function callTool(options: {
  /** 呼ぶツール */
  tool: ToolDefinition;
  /** 渡された引数 */
  args: unknown;
  /** サーバーの読む場所 */
  roots: ServerRoots;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): Promise<CallToolResult> {
  const { tool, roots, stderr } = options;
  const failure = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
  });
  // 作業のフォルダは引数から取り出して前提に入れ、ツールの引数の検査には渡さない
  if (typeof options.args !== "object" || options.args === null) {
    return failure(PROJECT_DIR_ERROR_MESSAGE);
  }
  const { [PROJECT_DIR_ARG]: projectDir, ...args } = options.args as Record<
    string,
    unknown
  >;
  if (!isProjectDir(projectDir)) {
    return failure(PROJECT_DIR_ERROR_MESSAGE);
  }
  const mismatch = checkArguments({ schema: tool.inputSchema, args });
  if (mismatch !== undefined) {
    return failure(mismatch);
  }
  try {
    const output = await tool.run(args, { ...roots, projectDir });
    return { content: [{ type: "text", text: JSON.stringify(output.json) }] };
  } catch (error) {
    if (error instanceof CliError) {
      return failure(error.message);
    }
    const message = error instanceof Error ? error.message : String(error);
    stderr(
      `[error] ${tool.name}: ${message}\n${error instanceof Error ? (error.stack ?? "") : ""}`,
    );
    return failure(message);
  }
}
