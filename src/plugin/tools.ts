import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { buildSite } from "../cli/build.ts";
import { collectCheckIssues } from "../cli/check.ts";
import { findConfigFile } from "../cli/config.ts";
import { CliError } from "../cli/errors.ts";
import { exportDocument } from "../cli/export.ts";
import { checkArguments, type ToolInputSchema } from "./arguments.ts";
import { readGuideIndex, readGuides } from "./guide.ts";

/** `mdmark serve` を起動したパッケージの直下から決める、使い方集と配布物のフォルダ */
export type ServerRoots = {
  /** 使い方集のフォルダ（`{パッケージの直下}/plugin/guide`） */
  guideDir: string;
  /** 書き出しに埋める配布物のフォルダ（`{パッケージの直下}/dist`） */
  distDir: string;
};

/** ツールの処理が使う、呼び出しの作業のフォルダとサーバーが読む使い方集・配布物の場所 */
export type ToolContext = ServerRoots & {
  /** 引数の `project_dir`。相対パスの引数と設定ファイルの探索の基準。`usesProjectDir` のツールには必ず入り、それ以外は `undefined` */
  projectDir: string | undefined;
};

/** ツールの処理が返す、テキストの並びか JSON にする値 */
export type ToolOutput = {
  /** そのままの文字で返すテキスト（`read_guide` の名前ごとの本文） */
  texts?: string[];
  /** JSON の文字列にして 1 つのテキストで返す値（`export_html`・`build_site`・`check`） */
  json?: Record<string, unknown>;
};

/** ツール 1 つの名前・説明・引数の形・処理 */
export type ToolDefinition = {
  name: "read_guide" | "export_html" | "build_site" | "check";
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
  /** 作業のフォルダを使うか。`true` のツールは引数の `project_dir` を必須にする。`project_dir` は `inputSchema` に含めない */
  usesProjectDir: boolean;
};

/** PreToolUse のフックが作業のフォルダの絶対パスを入れる引数の名前 */
export const PROJECT_DIR_ARG = "project_dir";

/** `project_dir` が無い・絶対パスでない・そのフォルダが無いときのツールのエラーの文 */
export const PROJECT_DIR_ERROR_MESSAGE =
  "引数 project_dir が無いか、ある作業のフォルダの絶対パスではありません。mdmark のプラグインを入れた Claude Code のセッションから呼んでください。";

/** `usesProjectDir` のツールの前提から作業のフォルダを取り出す。`callTool` が必ず入れるため、無いのはツールの定義の誤り */
function requireProjectDir(context: ToolContext): string {
  if (context.projectDir === undefined) {
    throw new Error("作業のフォルダがありません");
  }
  return context.projectDir;
}

/** 設定ファイルの引数の説明 */
const CONFIG_DESCRIPTION =
  "使う設定ファイルのパス。省くと、セッションのフォルダから上へ mdmark.config.yaml を探す";

/** 使い方集を読む: 同梱した索引を読み、名前ごとの本文をテキストで返す */
export async function runReadGuide(
  args: { names: string[] },
  context: ToolContext,
): Promise<ToolOutput> {
  const { guideDir } = context;
  const entries = await readGuideIndex(guideDir);
  const pages = await readGuides({ guideDir, entries, names: args.names });
  return { texts: pages.map((page) => page.text) };
}

/** 文書を HTML に書き出す: 作業のフォルダを基準に `mdmark export` と同じ処理で書き出し、絶対パスと警告を返す */
export async function runExportHtml(
  args: { file: string; out?: string; config?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const { out, warnings } = await exportDocument({
    cwd: requireProjectDir(context),
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
    cwd: requireProjectDir(context),
    config: args.config,
    distDir: context.distDir,
  });
  return { json: { out, docs, warnings } };
}

/** 点検する: 作業のフォルダから設定ファイルを探し、`mdmark check` と同じずれの一覧を返す。`base` を渡すと `change_together` の直し忘れも返す */
export async function runCheckTool(
  args: { config?: string; base?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const path = await findConfigFile(requireProjectDir(context), args.config);
  const issues = await collectCheckIssues(
    path,
    args.base === undefined ? {} : { base: args.base },
  );
  return { json: { issues } };
}

/** 登録する 4 つのツールの定義 */
export const TOOLS: ToolDefinition[] = [
  {
    name: "read_guide",
    usesProjectDir: false,
    description:
      "mdmark の記法・部品・図の描き方・拡張の仕方を確かめるときに、使い方集の索引の名前を渡して本文を読む。引数 names は索引の名前の配列（1 件以上）。名前ごとに「# {名前}」で始まる本文のテキストを、渡した順に返す。索引に無い名前があるときは、近い名前を添えたエラーを返す。",
    inputSchema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "読む使い方集の名前（索引の名前）の並び",
        },
      },
      required: ["names"],
      additionalProperties: false,
    },
    run: (args, context) => runReadGuide(args as { names: string[] }, context),
    annotations: { readOnlyHint: true },
  },
  {
    name: "export_html",
    usesProjectDir: true,
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
    usesProjectDir: true,
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
    usesProjectDir: true,
    description:
      "設定の形・索引と文書のずれ・build の対象の有無・知らない印を点検する（mdmark check と同じ処理）。設定・索引・文書は書き換えない。ずれの一覧 issues（file・where・kind・message）を JSON で返し、ずれがあってもエラーにしない。base に比べる基準の git の ref（例 origin/develop）を渡すと、基準と HEAD の merge-base から変わった文書を比べ、change_together の組のうち片方だけが変わった直し忘れも返す。",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "string", description: CONFIG_DESCRIPTION },
        base: {
          type: "string",
          description:
            "直し忘れの検査に比べる基準の git の ref。省くと直し忘れを検査しない",
        },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) =>
      runCheckTool(args as { config?: string; base?: string }, context),
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
  let args = options.args;
  let projectDir: string | undefined;
  if (tool.usesProjectDir && typeof args === "object" && args !== null) {
    const { [PROJECT_DIR_ARG]: given, ...rest } = args as Record<
      string,
      unknown
    >;
    if (!isProjectDir(given)) {
      return failure(PROJECT_DIR_ERROR_MESSAGE);
    }
    projectDir = given;
    args = rest;
  }
  const mismatch = checkArguments({ schema: tool.inputSchema, args });
  if (mismatch !== undefined) {
    return failure(mismatch);
  }
  try {
    const output = await tool.run(args as Record<string, unknown>, {
      ...roots,
      projectDir,
    });
    const texts = output.texts ?? [JSON.stringify(output.json ?? {})];
    return { content: texts.map((text) => ({ type: "text", text })) };
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
