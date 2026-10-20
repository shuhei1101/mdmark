import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CliError, type CliIo } from "./main.ts";

/** 雛形 1 つ: 置く先のパスと、`templates/` の中の正本のパス */
type TemplateFile = {
  /** 置く先のパス（置く先のフォルダからの相対パス） */
  path: string;
  /** `templates/` の中の正本のパス */
  source: string;
  /** TypeScript の雛形（`--js` のときは置かない）か、JavaScript の雛形（`--js` のときだけ置く）か。無ければ常に置く */
  language?: "ts" | "js";
};

/** `init` が置く雛形を、置く順に並べたもの */
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

/** 置く設定の雛形のパス */
const CONFIG_TEMPLATE = "mdmark.config.yaml";

/** 設定の雛形の `version` の行 */
const VERSION_LINE_PATTERN = /^version: .*$/m;

/** 失敗の理由を 1 行の文字にする */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `TEMPLATE_FILES` のうち置く先に無いものを写し、置いた・置かなかった行を出す */
export async function runInit(
  options: {
    /** 置く先のフォルダ */
    dir: string;
    /** 拡張の雛形を JavaScript で置くか */
    js: boolean;
    /** 雛形の正本のフォルダ */
    templatesDir: string;
    /** 呼んだ CLI の版（置く設定の `version` に書く） */
    version: string;
  },
  io: CliIo,
): Promise<0> {
  const { dir, js, templatesDir, version } = options;
  const wanted = js ? "js" : "ts";
  for (const template of TEMPLATE_FILES) {
    if (template.language !== undefined && template.language !== wanted) {
      continue;
    }
    const target = join(dir, template.path);
    const source = await readFile(join(templatesDir, template.source), "utf8");
    const content =
      template.path === CONFIG_TEMPLATE
        ? source.replace(VERSION_LINE_PATTERN, `version: ${version}`)
        : source;
    try {
      await mkdir(dirname(target), { recursive: true });
    } catch (error) {
      throw new CliError(
        `${template.path} に書けません（${reasonOf(error)}）。置く先のフォルダを確かめてください。`,
      );
    }
    try {
      // 既にあるファイルは中身を読まずに飛ばす
      await writeFile(target, content, { flag: "wx" });
      io.stdout(`置いた: ${template.path}`);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        io.stdout(`置かなかった（既にある）: ${template.path}`);
        continue;
      }
      throw new CliError(
        `${template.path} に書けません（${reasonOf(error)}）。置く先のフォルダを確かめてください。`,
      );
    }
  }
  return 0;
}
