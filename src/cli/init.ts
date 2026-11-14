import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CliError, type CliIo } from "./errors.ts";

/** 雛形 1 つ: 配置先のパスと、`templates/` の中の原本のパス */
type TemplateFile = {
  /** 配置先のパス（配置先のフォルダからの相対パス） */
  path: string;
  /** `templates/` の中の原本のパス */
  source: string;
  /** TypeScript の雛形（`--js` のときは配置しない）か、JavaScript の雛形（`--js` のときだけ配置する）か。無ければ常に配置する */
  language?: "ts" | "js";
};

/** `init` が配置する雛形を、配置する順に並べたもの */
export const TEMPLATE_FILES: readonly TemplateFile[] = [
  { path: "mdmark.config.yaml", source: "mdmark.config.yaml" },
  { path: "theme.css", source: "theme.css" },
  { path: "index.yaml", source: "index.yaml" },
  {
    path: "extensions/example.ts",
    source: "extensions/example.ts",
    language: "ts",
  },
  {
    path: "extensions/example.js",
    source: "extensions/example.js",
    language: "js",
  },
  { path: "tsconfig.json", source: "tsconfig.json", language: "ts" },
  { path: "tsconfig.json", source: "js/tsconfig.json", language: "js" },
  { path: "package.json", source: "package.json", language: "ts" },
];

/** 配置する設定の雛形のパス */
const CONFIG_TEMPLATE = "mdmark.config.yaml";

/** 設定の雛形の `version` の行 */
const VERSION_LINE_PATTERN = /^version: .*$/m;

/** 失敗の理由を 1 行の文字にする */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 書き込めないときの例外 */
const writeError = (path: string, error: unknown): CliError =>
  new CliError(
    `${path} に書き込めません（${reasonOf(error)}）。配置先のフォルダを確認してください。`,
  );

/** 雛形 1 つを配置する。既にあるファイルは中身を読み込まずに飛ばし、配置したかを返却する */
async function placeTemplate(options: {
  target: string;
  path: string;
  content: string;
}): Promise<boolean> {
  const { target, path, content } = options;
  try {
    await mkdir(dirname(target), { recursive: true });
  } catch (error) {
    throw writeError(path, error);
  }
  try {
    await writeFile(target, content, { flag: "wx" });
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw writeError(path, error);
  }
}

/** `TEMPLATE_FILES` のうち配置先に無いものをコピーし、配置した・配置しなかった行を出す */
export async function runInit(
  options: {
    /** 配置先のフォルダ */
    dir: string;
    /** 拡張の雛形を JavaScript で配置するか */
    js: boolean;
    /** 雛形の原本のフォルダ */
    templatesDir: string;
    /** 呼んだ CLI のバージョン（配置する設定の `version` に記載する） */
    version: string;
  },
  io: CliIo,
): Promise<0> {
  const { dir, js, templatesDir, version } = options;
  const wanted = js ? "js" : "ts";
  const templates = TEMPLATE_FILES.filter(
    (template) =>
      template.language === undefined || template.language === wanted,
  );
  for (const template of templates) {
    const source = await readFile(join(templatesDir, template.source), "utf8");
    const content =
      template.path === CONFIG_TEMPLATE
        ? source.replace(VERSION_LINE_PATTERN, `version: ${version}`)
        : source;
    const placed = await placeTemplate({
      target: join(dir, template.path),
      path: template.path,
      content,
    });
    io.stdout(
      placed
        ? `配置した: ${template.path}`
        : `配置しなかった（既にある）: ${template.path}`,
    );
  }
  return 0;
}
