import { readFile } from "node:fs/promises";
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
import { normalizePath } from "../knowledge/paths.ts";
import { collectReferences } from "../knowledge/references.ts";
import { buildTagVocabulary, countTags, listTags } from "../knowledge/tags.ts";
import { checkArguments, type ToolInputSchema } from "./arguments.ts";
import { readGuideIndex, readGuides } from "./guide.ts";
import {
  type DocField,
  decodeCursor,
  encodeCursor,
  FIND_DOCS_HINT,
  type FindDocsCursor,
  formatFindDocs,
  formatListTags,
  selectDocFields,
  toDocRow,
  unknownTagWarning,
} from "./results.ts";

/** ツールの処理が使う作業のフォルダとプラグインの場所 */
export type ToolContext = {
  /** Claude Code のセッションのフォルダ。相対パスの引数と設定ファイルの探索の基準 */
  projectDir: string;
  /** プラグインの直下。`guide/` と `dist/` を持つ */
  pluginDir: string;
};

/** ツールの処理が返す、テキストの並びか JSON にする値か structuredContent に入れる値 */
export type ToolOutput = {
  /** そのままの文字で返すテキスト（`read_guide` の名前ごとの本文と、`find_docs`・`list_tags` の `format: markdown` の結果） */
  texts?: string[];
  /** JSON の文字列にして 1 つのテキストで返す値（`export_html`・`build_site`・`check`・`update_index`） */
  json?: Record<string, unknown>;
  /** structuredContent に入れ、同じ値の JSON の文字列を 1 つのテキストでも返す値（`find_docs`・`list_tags` の `format: json` の結果） */
  structured?: Record<string, unknown>;
};

/** ツール 1 つの名前・説明・引数の形・処理 */
export type ToolDefinition = {
  name:
    | "read_guide"
    | "export_html"
    | "build_site"
    | "check"
    | "find_docs"
    | "update_index"
    | "list_tags";
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

/** 使い方集のフォルダと配布物のフォルダの、プラグインの直下からの名前 */
const GUIDE_DIR = "guide";
const DIST_DIR = "dist";

/** `find_docs` が `limit` を渡されないときに 1 回に返す文書の件数 */
export const FIND_DOCS_DEFAULT_LIMIT = 20;
/** `find_docs` の `limit` に渡せる最大の件数 */
export const FIND_DOCS_MAX_LIMIT = 100;

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

/** 点検する: 作業のフォルダから設定ファイルを探し、`mdmark check` と同じずれの一覧を返す。`base` を渡すと `change_together` の直し忘れも返す */
export async function runCheckTool(
  args: { config?: string; base?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const path = await findConfigFile(context.projectDir, args.config);
  const issues = await collectCheckIssues(
    path,
    args.base === undefined ? {} : { base: args.base },
  );
  return { json: { issues } };
}

/** `find_docs` の引数 */
type FindDocsArgs = {
  text?: string;
  tags?: string[];
  any_tags?: string[];
  related_to?: string;
  limit?: number;
  cursor?: string;
  view?: "brief" | "standard" | "full";
  include?: DocField[];
  exclude?: DocField[];
  count_only?: boolean;
  format?: "markdown" | "json";
  config?: string;
};

/** 文書のファイルの文字数（コードポイントの数）。索引の `path` を正規化して読んだ文書から引き、無ければ索引のフォルダからのパスでファイルを読む。読めなければ `null` */
async function countChars(options: {
  path: string;
  documents: Map<string, string>;
  indexDir: string;
}): Promise<number | null> {
  const { path, documents, indexDir } = options;
  const body = documents.get(normalizePath(path));
  if (body !== undefined) {
    return [...body].length;
  }
  try {
    return [...(await readFile(join(indexDir, path), "utf8"))].length;
  } catch {
    return null;
  }
}

/** 文書を探す: 設定の索引を読み、条件に当たる文書を主題のタグが当たる文書を上にして `limit` 件ずつ、選んだ項目と形式で返す */
export async function runFindDocs(
  args: FindDocsArgs,
  context: ToolContext,
): Promise<ToolOutput> {
  const loaded = await requireConfig(context.projectDir, args.config);
  const read = await requireIndexWithDocuments(loaded);
  const { index } = normalizeIndex(read.raw);
  // 続きの位置は、絞り込みの条件が前の呼び出しと同じときだけ読む
  const filter: FindDocsCursor["filter"] = {
    ...(args.text !== undefined && { text: args.text }),
    ...(args.tags !== undefined && { tags: args.tags }),
    ...(args.any_tags !== undefined && { any_tags: args.any_tags }),
    ...(args.related_to !== undefined && { related_to: args.related_to }),
  };
  const offset =
    args.cursor === undefined
      ? 0
      : decodeCursor({ cursor: args.cursor, filter });
  const { fields, omitted } = selectDocFields({
    view: args.view ?? "brief",
    include: args.include ?? [],
    exclude: args.exclude ?? [],
  });
  // 関係する文書を引くときか、被参照の数を返すときだけ、参照の表を作る
  const references =
    args.related_to === undefined && !fields.includes("referenced_by")
      ? undefined
      : collectReferences({
          index,
          documents: read.documents,
          config: { features: loaded.config.features ?? {} },
        });
  const { docs, relations, unknownTags } = findDocs({
    index,
    references,
    text: args.text,
    tags: args.tags,
    anyTags: args.any_tags,
    relatedTo: args.related_to,
  });
  const documents = new Map(
    Object.entries(read.documents).map(([path, body]) => [
      normalizePath(path),
      body,
    ]),
  );
  const chars = await Promise.all(
    docs.map((doc) =>
      countChars({ path: doc.path, documents, indexDir: read.indexDir }),
    ),
  );
  // 件数・文字数・タグごとの件数・警告は、返した件数でなく当たった全ての文書で数える
  const summary = {
    total: docs.length,
    total_chars: chars.reduce<number>((sum, count) => sum + (count ?? 0), 0),
    tag_counts: countTags({
      docs,
      vocabulary: buildTagVocabulary(index.tags),
    }),
    warnings: unknownTags.map(unknownTagWarning),
  };
  const limit = args.limit ?? FIND_DOCS_DEFAULT_LIMIT;
  const next = offset + limit;
  const hasMore = !args.count_only && next < docs.length;
  const result: Record<string, unknown> = args.count_only
    ? summary
    : {
        total: summary.total,
        returned: docs.slice(offset, next).length,
        total_chars: summary.total_chars,
        next_cursor: hasMore ? encodeCursor({ offset: next, filter }) : null,
        hint: hasMore ? FIND_DOCS_HINT : null,
        tag_counts: summary.tag_counts,
        warnings: summary.warnings,
        omitted,
        docs: docs.slice(offset, next).map((doc, position) =>
          toDocRow({
            doc,
            chars: chars[offset + position] ?? null,
            fields,
            references,
            relations:
              args.related_to === undefined ? undefined : relations[doc.id],
          }),
        ),
      };
  return args.format === "json"
    ? { structured: result }
    : { texts: [formatFindDocs(result)] };
}

/** タグの語彙を見る: 設定の索引を読み、タグの語彙を付いている文書の数つきで、選んだ形式で返す */
export async function runListTags(
  args: { query?: string; format?: "markdown" | "json"; config?: string },
  context: ToolContext,
): Promise<ToolOutput> {
  const loaded = await requireConfig(context.projectDir, args.config);
  const read = await requireIndexWithDocuments(loaded);
  const { index } = normalizeIndex(read.raw);
  const tags = listTags({ index, query: args.query });
  return args.format === "json"
    ? { structured: { tags } }
    : { texts: [formatListTags(tags)] };
}

/** 索引を書き換える: 設定の索引の項目を書き換え、したことと索引のパスを返す */
export async function runUpdateIndex(
  args: {
    kind: "doc" | "term" | "tag";
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

/** 登録する 7 つのツールの定義 */
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
    annotations: { readOnlyHint: true },
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
  {
    name: "find_docs",
    description:
      "設定の index の索引から、題・別名・概要の語、タグの AND / OR、関係する文書で文書を引く。条件は全てを満たす文書に絞り、渡したタグが主題のタグに当たる文書を上に並べて、limit 件（既定 20、上限 100）ずつ返す。tags は全てを持つ文書（AND）、any_tags はどれかを持つ文書（OR）で、語彙の別名は語彙のタグの名前として引く。タグを渡す前に、list_tags で語彙を確かめられる。語彙に無いタグを渡しても拒まず、警告 warnings に近いタグを添える。続きがあるときは next_cursor を cursor に渡す（絞り込みの条件は前の呼び出しと同じにする）。view（brief・standard・full）と include・exclude で各行に返す項目を選び、省いた項目は omitted に取り方つきで返す。count_only: true は総件数・合計文字数・タグごとの件数だけを返す。format は markdown（既定。表のテキストだけ）か json（structuredContent と text に同じ JSON）。",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "題・別名・概要のどれかに含まれる語。語と題・別名・概要の両方を NFKC・英字の小文字化・前後の空白の除去で正規化して比べる",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "全てを持つ文書に絞るタグ（AND）",
        },
        any_tags: {
          type: "array",
          items: { type: "string" },
          description:
            "どれかを持つ文書に絞るタグ（OR）。tags と一緒に渡すと、両方を満たす文書に絞る",
        },
        related_to: {
          type: "string",
          description:
            "この文書の ID から参照している文書と、この文書を参照している文書に絞る",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: FIND_DOCS_MAX_LIMIT,
          description: `1 回に返す文書の件数。既定 ${FIND_DOCS_DEFAULT_LIMIT}`,
        },
        cursor: {
          type: "string",
          description: "前の結果の next_cursor。続きの文書を返す",
        },
        view: {
          type: "string",
          enum: ["brief", "standard", "full"],
          description:
            "各行に返す項目の組。brief は ID・題・概要・タグ・文字数、standard は brief にパス・別名、full は standard に関連する文書・被参照の数を加える。既定 brief",
        },
        include: {
          type: "array",
          items: {
            type: "string",
            enum: ["path", "aliases", "related", "referenced_by"],
          },
          description: "view の組に加える項目",
        },
        exclude: {
          type: "array",
          items: {
            type: "string",
            enum: ["path", "aliases", "related", "referenced_by"],
          },
          description: "view の組から除く項目（include の後に当てる）",
        },
        count_only: {
          type: "boolean",
          description:
            "true のとき、文書の行を返さず、総件数・合計文字数・タグごとの件数だけを返す",
        },
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "結果の形式。既定 markdown",
        },
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) => runFindDocs(args as FindDocsArgs, context),
    annotations: { readOnlyHint: true },
  },
  {
    name: "update_index",
    description:
      "設定の index の索引の、文書・用語の ID かタグの語彙の名前の項目を置き換える。ID（タグは名前）が無ければ末尾に追加し、item が null ならその項目を消す。書く前に、書き換えた後の索引を索引のスキーマで検査し、合わなければ書かずにエラーを返す。文書の related は、to（相手の文書の id）・type（requires・references・replaces・part_of・change_together のどれか）・when（いつ読むかの 1 文）と、任意で paths（関連が当たるファイルの glob の並び）を持つオブジェクトの並びで渡す。したこと action（added・replaced・removed）と索引のパス index を JSON で返す。",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["doc", "term", "tag"],
          description:
            "書き換えるのが文書（doc）か用語（term）かタグの語彙（tag）か",
        },
        id: {
          type: "string",
          minLength: 1,
          description: "文書か用語の ID、タグの語彙の名前",
        },
        item: {
          type: ["object", "null"],
          description:
            "その項目の中身（id・name を除くキー）。項目ごと置き換える。null なら項目を消す",
        },
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: ["kind", "id", "item"],
      additionalProperties: false,
    },
    run: (args, context) =>
      runUpdateIndex(
        args as {
          kind: "doc" | "term" | "tag";
          id: string;
          item: Record<string, unknown> | null;
          config?: string;
        },
        context,
      ),
  },
  {
    name: "list_tags",
    description:
      "設定の index の索引のタグの語彙を、タグごとの名前・グループ・説明・別名・振り替え先と、付いている文書の数つきで、語彙の並びで返す。付いている文書が 0 件のタグも返す。query を渡すと、名前・別名・説明のどれかに含まれるタグに絞る（query と名前・別名・説明の両方を NFKC・英字の小文字化・前後の空白の除去で正規化して比べる）。語彙が多いときに、find_docs へ渡すタグを選ぶために呼ぶ。format は markdown（既定。表のテキストだけ）か json（structuredContent と text に同じ JSON）。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "タグの名前・別名・説明のどれかに含まれる語。語と名前・別名・説明の両方を NFKC・英字の小文字化・前後の空白の除去で正規化して比べる",
        },
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "結果の形式。既定 markdown",
        },
        config: { type: "string", description: CONFIG_DESCRIPTION },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) =>
      runListTags(
        args as {
          query?: string;
          format?: "markdown" | "json";
          config?: string;
        },
        context,
      ),
    annotations: { readOnlyHint: true },
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
    if (output.structured !== undefined) {
      return {
        content: [{ type: "text", text: JSON.stringify(output.structured) }],
        structuredContent: output.structured,
      };
    }
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
