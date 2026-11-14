import { statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
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
import {
  addTemplate,
  applyTemplate,
  listTemplates,
  resolveTemplatesDir,
} from "./templates.ts";

/** `mdmark serve` を起動したパッケージの直下から決める、配布物のフォルダ */
export type ServerRoots = {
  /** 書き出しに埋める配布物のフォルダ（`{パッケージの直下}/dist`） */
  distDir: string;
};

/** ツールの処理が使用する、呼び出しの作業のフォルダとサーバーが読み込む配布物の場所 */
export type ToolContext = ServerRoots & {
  /** 引数の `project_dir`。相対パスの引数と設定ファイルの探索の基準 */
  projectDir: string;
};

/** ツールの処理が返却する、JSON にする値 */
export type ToolOutput = {
  /** JSON の文字列にして 1 つのテキストで返却する値 */
  json: Record<string, unknown>;
};

/** ツール 1 つの名前・説明・引数の構造・処理 */
export type ToolDefinition = {
  name:
    | "export_html"
    | "build_site"
    | "check"
    | "list_templates"
    | "add_template"
    | "apply_template";
  /** ツールの説明。呼ぶ場面と、引数・戻り値を日本語で記載する */
  description: string;
  /** 引数の構造。`tools/list` に JSON Schema として出し、引数を検査するものにも使用する */
  inputSchema: ToolInputSchema;
  /** 検査を通った引数で処理し、結果を返却する。利用者に見せる誤りは `CliError` を投げる */
  run: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ToolOutput>;
  /** `tools/list` に出すツールの annotations。何も書き換えないツールだけが持つ */
  annotations?: { readOnlyHint: boolean };
};

/** PreToolUse のフックが作業のフォルダの絶対パスを入れる引数の名前 */
export const PROJECT_DIR_ARG = "project_dir";

/** `project_dir` が無い・絶対パスでない・そのフォルダが無いときのツールのエラーの文 */
export const PROJECT_DIR_ERROR_MESSAGE =
  "引数 project_dir が無いか、ある作業のフォルダの絶対パスではありません。mdmark のプラグインを入れた Claude Code のセッションから呼んでください。";

/** 隠さない書き出しの引数の説明 */
const KEEP_TRACES_DESCRIPTION =
  "true のとき、開発用に mdmark の名前・HTML のコメント・バージョンを残して書き出す。省くと mdmark を使用していることを隠して書き出す";

/** 設定ファイルの引数の説明 */
const CONFIG_DESCRIPTION =
  "使用する設定ファイルのパス。省くと、セッションのフォルダから上へ mdmark.config.yaml を探す";

/** 文書を HTML に書き出す: 作業のフォルダを基準に `mdmark export` と同じ処理で書き出し、絶対パスと警告を返却する */
export async function runExportHtml(
  args: { file: string; out?: string; config?: string; keep_traces?: boolean },
  context: ToolContext,
): Promise<ToolOutput> {
  const { out, warnings } = await exportDocument({
    cwd: context.projectDir,
    file: args.file,
    out: args.out,
    config: args.config,
    distDir: context.distDir,
    keepTraces: args.keep_traces,
  });
  return { json: { out, warnings } };
}

/** 複数の文書を 1 枚にまとめる: 作業のフォルダを基準に `mdmark build` と同じ処理でまとめ、絶対パス・文書の数・警告を返却する */
export async function runBuildSite(
  args: { config?: string; keep_traces?: boolean },
  context: ToolContext,
): Promise<ToolOutput> {
  const { out, docs, warnings } = await buildSite({
    cwd: context.projectDir,
    config: args.config,
    distDir: context.distDir,
    keepTraces: args.keep_traces,
  });
  return { json: { out, docs, warnings } };
}

/** 点検する: 作業のフォルダから設定ファイルを探し、`mdmark check` と同じずれの一覧を返却する。`base` を指定すると `change_together` の修正漏れも返却する。`text` か `file` と `key` を指定すると、`mdmark check --text`・`--file --key` と同じく指定した Markdown の記法だけを点検する */
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

/** `mdmark serve` のプロセスの環境変数から、テンプレートのフォルダを決める */
const templatesDir = (): string =>
  resolveTemplatesDir({ env: process.env, home: homedir() });

/** CSS のテンプレートの一覧を返却する: テンプレートのフォルダの索引の行を、CSS の絶対パスを付けて返却する */
export async function runListTemplates(
  _context: ToolContext,
): Promise<ToolOutput> {
  return { json: { templates: await listTemplates(templatesDir()) } };
}

/** CSS のテンプレートを登録する: `file` を作業のフォルダから解決し、テンプレートに登録する */
export async function runAddTemplate(
  args: {
    file: string;
    name: string;
    description: string;
    tags?: string[];
    overwrite?: boolean;
  },
  context: ToolContext,
): Promise<ToolOutput> {
  const result = await addTemplate({
    dir: templatesDir(),
    source: resolve(context.projectDir, args.file),
    name: args.name,
    description: args.description,
    tags: args.tags ?? [],
    overwrite: args.overwrite ?? false,
  });
  return { json: result };
}

/** CSS のテンプレートを配置する: `dir` を作業のフォルダから解決し、テンプレートを配置する */
export async function runApplyTemplate(
  args: { name: string; dir?: string; overwrite?: boolean },
  context: ToolContext,
): Promise<ToolOutput> {
  const result = await applyTemplate({
    dir: templatesDir(),
    name: args.name,
    cwd: context.projectDir,
    target:
      args.dir === undefined
        ? undefined
        : resolve(context.projectDir, args.dir),
    overwrite: args.overwrite ?? false,
  });
  return { json: result };
}

/** 登録するツールの定義（どのツールも引数の `project_dir` を必須にし、`project_dir` は `inputSchema` に含めない） */
export const TOOLS: ToolDefinition[] = [
  {
    name: "export_html",
    description:
      "Markdown の文書を 1 つ、外へ要求しない 1 枚の HTML に書き出す（mdmark export と同じ処理）。引数 file は書き出す文書、out は書き出す HTML のパス（省くと文書と同じフォルダの .html）。書き出した HTML の絶対パス out と警告 warnings を JSON で返却する。",
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
        keep_traces: { type: "boolean", description: KEEP_TRACES_DESCRIPTION },
      },
      required: ["file"],
      additionalProperties: false,
    },
    run: (args, context) =>
      runExportHtml(
        args as {
          file: string;
          out?: string;
          config?: string;
          keep_traces?: boolean;
        },
        context,
      ),
  },
  {
    name: "build_site",
    description:
      "設定の build で決めた文書を、行き来できる 1 枚の HTML にまとめる（mdmark build と同じ処理）。書き出した HTML の絶対パス out・入れた文書の数 docs・警告 warnings を JSON で返却する。",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "string", description: CONFIG_DESCRIPTION },
        keep_traces: { type: "boolean", description: KEEP_TRACES_DESCRIPTION },
      },
      required: [],
      additionalProperties: false,
    },
    run: (args, context) =>
      runBuildSite(args as { config?: string; keep_traces?: boolean }, context),
  },
  {
    name: "check",
    description:
      "設定の構造・索引と文書のずれ・build の対象の有無・知らないマーカー・include のマーカーの取り込み先を点検する（mdmark check と同じ処理）。設定・索引・文書は書き換えない。ずれの一覧 issues（file・where・kind・message）を JSON で返却し、ずれがあってもエラーにしない。base に比べる基準の git の ref（例 origin/develop）を指定すると、基準と HEAD の merge-base から変わった文書を比べ、change_together の組のうち片方だけが変わった修正漏れも返却する。text に Markdown の文字列、または file に YAML のファイルと key にキーのパスを指定すると、設定と索引は点検せず、その Markdown を描いたときの記載の警告・描くときに無視するマーカーの知らない引数・知らないマーカー・図の配置のずれだけを返却する（text は file が -、file は where が YAML のファイルの行）。",
    inputSchema: {
      type: "object",
      properties: {
        config: { type: "string", description: CONFIG_DESCRIPTION },
        base: {
          type: "string",
          description:
            "修正漏れの検査に比べる基準の git の ref。省くと修正漏れを検査しない",
        },
        text: {
          type: "string",
          description:
            "点検する Markdown の文字列。base・file・key と一緒に指定できない",
        },
        file: {
          type: "string",
          minLength: 1,
          description:
            "Markdown をキーの値に持つ YAML のファイルのパス（project_dir からの相対パスか絶対パス）。key と一緒に指定する",
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
  {
    name: "list_templates",
    description:
      "端末の設定のフォルダの templates/css/ にある CSS のテンプレートを、名前 name・説明 description・タグ tags・CSS の絶対パス path の一覧 templates で JSON にして返却する。利用側の CSS を探すときに呼ぶ。テンプレートが無ければ空の一覧を返却する。何も書き換えない。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    run: (_args, context) => runListTemplates(context),
    annotations: { readOnlyHint: true },
  },
  {
    name: "add_template",
    description:
      "作業のフォルダの CSS を、端末の設定のフォルダの CSS のテンプレートに {name}.css でコピーし、名前・説明・タグを索引 templates.yaml に記載する。作った CSS を使い回すときに呼ぶ。同じ名前があるときは overwrite が true のときだけ置き換える。登録した名前 name・CSS の絶対パス path・置き換えたか replaced を JSON で返却する。",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          minLength: 1,
          description:
            "登録する CSS のパス（project_dir からの相対パスか絶対パス）",
        },
        name: {
          type: "string",
          minLength: 1,
          description:
            "テンプレートの名前。英小文字・数字・- の 1〜64 文字で、英小文字か数字で始まる",
        },
        description: {
          type: "string",
          minLength: 1,
          description: "どんな外観にする CSS か・どんな文書に向くか",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "探すときの単語。省くと空",
        },
        overwrite: {
          type: "boolean",
          description: "同じ名前のテンプレートを置き換えるか。既定は false",
        },
      },
      required: ["file", "name", "description"],
      additionalProperties: false,
    },
    run: (args, context) =>
      runAddTemplate(
        args as {
          file: string;
          name: string;
          description: string;
          tags?: string[];
          overwrite?: boolean;
        },
        context,
      ),
  },
  {
    name: "apply_template",
    description:
      "CSS のテンプレートを配置先のフォルダへ {name}.css でコピーし、配置した絶対パス path・設定の theme に記載する値 theme・置き換えたか replaced を JSON で返却する。dir を省くと、作業のフォルダから上へ探して最も近い mdmark.config.yaml のフォルダに配置する。theme は書き換えないので、返った theme の値を設定の theme に記載する。配置先に中身の違う同じ名前のファイルがあるときは overwrite が true のときだけ置き換える。",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          minLength: 1,
          description: "配置するテンプレートの名前",
        },
        dir: {
          type: "string",
          minLength: 1,
          description:
            "配置先のフォルダ（project_dir からの相対パスか絶対パス）。省くと最も近い mdmark.config.yaml のフォルダ",
        },
        overwrite: {
          type: "boolean",
          description: "配置先の同じ名前のファイルを置き換えるか。既定は false",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
    run: (args, context) =>
      runApplyTemplate(
        args as { name: string; dir?: string; overwrite?: boolean },
        context,
      ),
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
  /** 指定された引数 */
  args: unknown;
  /** サーバーの読み込む場所 */
  roots: ServerRoots;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): Promise<CallToolResult> {
  const { tool, roots, stderr } = options;
  const failure = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
  });
  // 作業のフォルダは引数から取り出して前提に入れ、ツールの引数の検査には指定しない
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
