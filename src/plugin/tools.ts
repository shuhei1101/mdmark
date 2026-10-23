import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { buildSite } from "../cli/build.ts";
import { collectCheckIssues } from "../cli/check.ts";
import { findConfigFile, requireConfig } from "../cli/config.ts";
import { CliError } from "../cli/errors.ts";
import { exportDocument } from "../cli/export.ts";
import {
  requireIndexWithDocuments,
  updateIndexFile,
} from "../cli/index-file.ts";
import { findDocs } from "../knowledge/find.ts";
import { normalizeIndex } from "../knowledge/index-shape.ts";
import { collectReferences } from "../knowledge/references.ts";
import { checkArguments, type ToolInputSchema } from "./arguments.ts";
import { readGuideIndex, readGuides } from "./guide.ts";

/** ツールの処理が使う作業のフォルダとプラグインの場所 */
export type ToolContext = {
  /** Claude Code のセッションのフォルダ。相対パスの引数と設定ファイルの探索の基準 */
  projectDir: string;
  /** プラグインの直下。`guide/` と `dist/` を持つ */
  pluginDir: string;
};

/** ツールの処理が返す、テキストの並びか JSON にする値 */
export type ToolOutput = {
  /** そのままの文字で返すテキスト（`read_guide` の名前ごとの本文） */
  texts?: string[];
  /** JSON の文字列にして 1 つのテキストで返す値（他のツール） */
  json?: Record<string, unknown>;
};

/** ツール 1 つの名前・説明・引数の形・処理 */
export type ToolDefinition = {
  name:
    | "read_guide"
    | "export_html"
    | "build_site"
    | "check"
    | "find_docs"
    | "update_index";
  /** ツールの説明。呼ぶ場面と、引数・戻り値を日本語で書く */
  description: string;
  /** 引数の形。`tools/list` に JSON Schema として出し、引数を検査するものにも使う */
  inputSchema: ToolInputSchema;
  /** 検査を通った引数で処理し、結果を返す。利用者に見せる誤りは `CliError` を投げる */
  run: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ToolOutput>;
};

/** 使い方集のフォルダと配布物のフォルダの、プラグインの直下からの名前 */
const GUIDE_DIR = "guide";
const DIST_DIR = "dist";

/** 設定ファイルの引数の説明 */
const CONFIG_DESCRIPTION =
  "使う設定ファイルのパス。省くと、セッションのフォルダから上へ mdmark.config.yaml を探す";

/** 使い方集を読む: 同梱した索引を読み、名前ごとの本文をテキストで返す */
export async function runReadGuide(
  args: { names: string[] },
  context: ToolContext,
): Promise<ToolOutput> {
  const guideDir = join(context.pluginDir, GUIDE_DIR);
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
    cwd: context.projectDir,
    file: args.file,
    out: args.out,
    config: args.config,
    distDir: join(context.pluginDir, DIST_DIR),
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
    distDir: join(context.pluginDir, DIST_DIR),
  });
  return { json: { out, docs, warnings } };
}

/** 点検する: 作業のフォルダから設定ファイルを探し、`mdmark check` と同じずれの一覧を返す */
export async function runCheckTool(
  args: { config?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const path = await findConfigFile(context.projectDir, args.config);
  const issues = await collectCheckIssues(path);
  return { json: { issues } };
}

/** 文書を探す: 設定の索引を読み、条件に当たる文書の ID・パス・題・概要・タグを返す */
export async function runFindDocs(
  args: {
    text?: string;
    tags?: string[];
    related_to?: string;
    config?: string;
  },
  context: ToolContext,
): Promise<ToolOutput> {
  const loaded = await requireConfig(context.projectDir, args.config);
  const read = await requireIndexWithDocuments(loaded);
  const { index } = normalizeIndex(read.raw);
  // 関係する文書を引くときだけ、参照の表を作る
  const references =
    args.related_to === undefined
      ? undefined
      : collectReferences({
          index,
          documents: read.documents,
          config: { features: loaded.config.features ?? {} },
        });
  const docs = findDocs({
    index,
    references,
    text: args.text,
    tags: args.tags,
    relatedTo: args.related_to,
  });
  return {
    json: {
      docs: docs.map((doc) => ({
        id: doc.id,
        path: doc.path,
        title: doc.title,
        description: doc.description ?? null,
        tags: doc.tags ?? [],
      })),
    },
  };
}

/** 索引を書き換える: 設定の索引の項目を書き換え、したことと索引のパスを返す */
export async function runUpdateIndex(
  args: {
    kind: "doc" | "term";
    id: string;
    item: Record<string, unknown> | null;
    config?: string;
  },
  context: ToolContext,
): Promise<ToolOutput> {
  const loaded = await requireConfig(context.projectDir, args.config);
  const { action, index } = await updateIndexFile({
    loaded,
    kind: args.kind,
    id: args.id,
    item: args.item,
  });
  return { json: { action, index } };
}

/** 登録する 6 つのツールの定義 */
export const TOOLS: ToolDefinition[] = [
  {
    name: "read_guide",
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
  },
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
      "設定の形・索引と文書のずれ・build の対象の有無・知らない印を点検する（mdmark check と同じ処理）。設定・索引・文書は書き換えない。ずれの一覧 issues（file・where・kind・message）を JSON で返し、ずれがあってもエラーにしない。",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) => runCheckTool(args as { config?: string }, context),
  },
  {
    name: "find_docs",
    description:
      "設定の index の索引から、題・別名・概要の語、タグ、関係する文書で文書を引く。条件は全てを満たす文書に絞る。文書の一覧 docs（id・path・title・description・tags）を索引の並びで JSON で返す。",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "題・別名・概要のどれかに含まれる語（大文字と小文字を区別しない）",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "全てを持つ文書に絞るタグ",
        },
        related_to: {
          type: "string",
          description:
            "この文書の ID から参照している文書と、この文書を参照している文書に絞る",
        },
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) =>
      runFindDocs(
        args as {
          text?: string;
          tags?: string[];
          related_to?: string;
          config?: string;
        },
        context,
      ),
  },
  {
    name: "update_index",
    description:
      "設定の index の索引の、文書か用語の ID の項目を置き換える。ID が無ければ末尾に追加し、item が null ならその項目を消す。書く前に、書き換えた後の索引を索引のスキーマで検査し、合わなければ書かずにエラーを返す。したこと action（added・replaced・removed）と索引のパス index を JSON で返す。",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["doc", "term"],
          description: "書き換えるのが文書（doc）か用語（term）か",
        },
        id: { type: "string", minLength: 1, description: "文書か用語の ID" },
        item: {
          type: ["object", "null"],
          description:
            "その ID の項目の中身（id を除くキー）。項目ごと置き換える。null なら項目を消す",
        },
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: ["kind", "id", "item"],
      additionalProperties: false,
    },
    run: (args, context) =>
      runUpdateIndex(
        args as {
          kind: "doc" | "term";
          id: string;
          item: Record<string, unknown> | null;
          config?: string;
        },
        context,
      ),
  },
];

/** 引数を検査してツールの処理を呼び、結果か誤りを MCP のツールの結果にする。どの誤りでもサーバーを止めず、その呼び出しだけを `isError` にする */
export async function callTool(options: {
  /** 呼ぶツール */
  tool: ToolDefinition;
  /** 渡された引数 */
  args: unknown;
  /** ツールの前提 */
  context: ToolContext;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): Promise<CallToolResult> {
  const { tool, args, context, stderr } = options;
  const failure = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
  });
  const mismatch = checkArguments({ schema: tool.inputSchema, args });
  if (mismatch !== undefined) {
    return failure(mismatch);
  }
  try {
    const output = await tool.run(args as Record<string, unknown>, context);
    const texts = output.texts ?? [JSON.stringify(output.json ?? {})];
    return { content: texts.map((text) => ({ type: "text", text })) };
  } catch (error) {
    if (error instanceof CliError) {
      return failure(error.message);
    }
    const message = error instanceof Error ? error.message : String(error);
    // 標準出力は MCP のやり取りにだけ使うため、ログは標準エラーへ書く
    stderr(
      `[error] ${tool.name}: ${message}\n${error instanceof Error ? (error.stack ?? "") : ""}`,
    );
    return failure(message);
  }
}
