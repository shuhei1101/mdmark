import { existsSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { build } from "esbuild";
import { Linter, type SourceCode } from "eslint";
import compat from "eslint-plugin-compat";
import { BROWSER_TARGETS, bundleDefines, postcssStubPlugin } from "./bundle.ts";

/** 対応ブラウザの下限に無い API の使用 1 件 */
export type BaselineViolation = {
  /** 照らした JS に該当する配布ファイル（`dist/index.js` など） */
  file: string;
  /** minify せずにまとめた JS の中の行（1 始まり） */
  line: number;
  /** minify せずにまとめた JS の中の列（1 始まり） */
  column: number;
  /** API の名前（`Intl.Segmenter` など） */
  api: string;
  /** eslint-plugin-compat の報告の文 */
  message: string;
};

/** `SourceCode` が返却する構文木のノード */
type AstNode = NonNullable<ReturnType<SourceCode["getNodeByRangeIndex"]>>;

/** 対応ブラウザの下限と照らす、利用側のブラウザが読み込む JS の入口と、照らした結果に出す配布ファイルの名前 */
const BASELINE_ENTRIES = [
  { in: "src/index.ts", out: "index" },
  { in: "src/views/index.ts", out: "view" },
  { in: "src/comments/index.ts", out: "comments" },
  { in: "src/viewer/index.ts", out: "viewer" },
];
// esbuild の target の記載方法: 小文字の名前と、数字と `.` のバージョン
const TARGET_PATTERN = /^([a-z]+)([0-9.]+)$/;
// eslint-plugin-compat の報告の文の頭: API の名前（関数・コンストラクタは `()` が付く）
const API_PATTERN = /^(\S+?)(?:\(\))? is not supported in /;
// 報告を取る規則の名前
const COMPAT_RULE = "compat/compat";
// `noInlineConfig` で読み込まないコメントに ESLint が付ける通知の文の一部
const INLINE_CONFIG_NOTICE =
  "has no effect because you have 'noInlineConfig' setting";
// まとめた JS を書き出す配布フォルダ（まとめはメモリに配置し、記載しない）
const DIST_DIR = "dist";

/** esbuild の target の記載方法（`chrome99`）を browserslist の記載方法（`chrome 99`）に修正する */
export function toBrowserslist(targets: string[]): string[] {
  return targets.map((target) => {
    const match = TARGET_PATTERN.exec(target);
    if (!match) {
      throw new Error(`target の書式が違う: ${target}`);
    }
    return `${match[1]} ${match[2]}`;
  });
}

/** ノードの中（自分を含む）に、`api` と同じ文字列の `typeof` の単項式があるかを返却する */
function containsTypeofOf(options: {
  sourceCode: SourceCode;
  node: AstNode;
  api: string;
}): boolean {
  const { sourceCode, node, api } = options;
  if (
    node.type === "UnaryExpression" &&
    node.operator === "typeof" &&
    sourceCode.getText(node.argument) === api
  ) {
    return true;
  }
  const keys = sourceCode.visitorKeys[node.type] ?? [];
  return keys.some((key) => {
    const child = (node as unknown as Record<string, unknown>)[key];
    const children = Array.isArray(child) ? child : [child];
    return children.some(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        "type" in item &&
        containsTypeofOf({ sourceCode, node: item as AstNode, api }),
    );
  });
}

/** 報告の位置が、同じ API の `typeof` を条件に持つ `if` の中（ブロックか条件の式）にあるかを返却する */
export function isGuardedByTypeof(options: {
  /** まとめた JS の `SourceCode` */
  sourceCode: SourceCode;
  /** 報告の行（1 始まり） */
  line: number;
  /** 報告の列（1 始まり） */
  column: number;
  /** API の名前 */
  api: string;
}): boolean {
  const { sourceCode, line, column, api } = options;
  // `getIndexFromLoc` の列は 0 始まり
  const index = sourceCode.getIndexFromLoc({ line, column: column - 1 });
  const node = sourceCode.getNodeByRangeIndex(index);
  if (!node) {
    return false;
  }
  return [node, ...sourceCode.getAncestors(node)].some(
    (ancestor) =>
      ancestor.type === "IfStatement" &&
      containsTypeofOf({ sourceCode, node: ancestor.test, api }),
  );
}

/** まとめた JS 1 つに eslint-plugin-compat を実行し、同じ API の `typeof` の確認の中を除いた報告を返却する。照らせなかったときは例外を投げる */
export function lintBundle(options: {
  /** まとめた JS */
  code: string;
  /** 照らした JS に該当する配布ファイル。ESLint に指定するファイル名を兼ねる */
  file: string;
}): BaselineViolation[] {
  const { code, file } = options;
  const linter = new Linter({ configType: "flat" });
  const messages = linter.verify(
    code,
    [
      {
        files: ["**/*.js"],
        plugins: { compat },
        languageOptions: { ecmaVersion: "latest", sourceType: "module" },
        // まとめた依存が持つ、他のプラグインの規則を無効にするコメントを読み込まない
        linterOptions: { noInlineConfig: true },
        settings: {
          browsers: toBrowserslist(BROWSER_TARGETS),
          // `if` の中の使用も数え、削除するのは `isGuardedByTypeof` に任せる
          ignoreConditionalChecks: true,
        },
        rules: { [COMPAT_RULE]: "error" },
      },
    ],
    file,
  );
  // 構文として読み込めない・設定が該当しないときは何も照らさず 0 件になるため、止める
  const unexpected = messages.find(
    (message) =>
      message.ruleId !== COMPAT_RULE &&
      !(
        message.ruleId === null &&
        message.message.includes(INLINE_CONFIG_NOTICE)
      ),
  );
  if (unexpected) {
    throw new Error(
      `まとめた JS を下限のバージョンと照らせない: ${file}:${unexpected.line}:${unexpected.column} ${unexpected.message}`,
    );
  }
  const sourceCode = linter.getSourceCode();
  return messages
    .filter((message) => message.ruleId === COMPAT_RULE)
    .map((message) => {
      const api = API_PATTERN.exec(message.message)?.[1];
      if (!api) {
        throw new Error(`報告の文から API を取れない: ${message.message}`);
      }
      return {
        file,
        line: message.line,
        column: message.column,
        api,
        message: message.message,
      };
    })
    .filter(
      (violation) =>
        !isGuardedByTypeof({
          sourceCode,
          line: violation.line,
          column: violation.column,
          api: violation.api,
        }),
    );
}

/** 利用側のブラウザが読み込む JS を minify せずにまとめ、対応ブラウザの下限に無い API の使用を返却する */
export async function findBaselineViolations(options: {
  /** 作業ツリーの場所 */
  root: string;
  /** `define` に埋めるバージョン */
  version: string;
}): Promise<BaselineViolation[]> {
  const { root, version } = options;
  const entries = BASELINE_ENTRIES.filter((entry) =>
    existsSync(join(root, entry.in)),
  );
  if (entries.length === 0) {
    return [];
  }
  const result = await build({
    absWorkingDir: root,
    entryPoints: entries,
    outdir: DIST_DIR,
    bundle: true,
    format: "esm",
    minify: false,
    write: false,
    target: BROWSER_TARGETS,
    plugins: [postcssStubPlugin],
    define: bundleDefines(version),
    logLevel: "silent",
  });
  return entries.flatMap((entry) => {
    const file = posix.join(DIST_DIR, `${entry.out}.js`);
    const output = result.outputFiles.find(
      (candidate) =>
        relative(root, candidate.path).split(sep).join(posix.sep) === file,
    );
    if (!output) {
      throw new Error(`まとめた JS が無い: ${file}`);
    }
    return lintBundle({ code: output.text, file });
  });
}
