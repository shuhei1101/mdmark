import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { build } from "esbuild";
import { bundleModule } from "../bundle-module.ts";
import type { MdmarkConfig } from "../config.ts";
import {
  type MdmarkExtension,
  registerExtension,
  resetExtensions,
} from "../extensions.ts";
import {
  type MdmarkFigure,
  toPureMarkdown,
} from "../markdown/pure-markdown.ts";
import { importBundledCode } from "./check.ts";
import type { LoadedConfig } from "./config.ts";
import { requireConfig } from "./config.ts";
import { CliError, type CliIo } from "./errors.ts";
import { readDistAssets } from "./export.ts";
import { figureToSvg } from "./figure-svg.ts";
import { collectIncludes } from "./includes.ts";

/** 書き出す SVG を配置するフォルダの名前 */
const IMAGES_DIR = "images";

/** 文書の拡張子（長い方から照らす） */
const DOCUMENT_EXTENSION_PATTERN = /(?:\.mark)?\.md$/i;

/** `images/` に配置する SVG 1 つ */
type ImageFile = { name: string; svg: string };

/** OS の区切りを `/` にそろえる */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** 失敗の理由を 1 行の文字にする */
function reasonOf(error: unknown): string {
  return (
    (error instanceof Error ? error.message : String(error)).split("\n")[0] ??
    ""
  );
}

/** 文書のファイル名から `.mark.md`・`.md` を除いた名前と、文書と同じフォルダの `{名前}-markdown` の出力のフォルダ */
export function markdownOutDir(file: string): { name: string; dir: string } {
  const name = basename(file).replace(DOCUMENT_EXTENSION_PATTERN, "");
  return { name, dir: join(dirname(file), `${name}-markdown`) };
}

/** 図の場所に入れる Markdown の行。`chart`・`param` はタイトル・画像・系列が 2 つ以上のときの系列の行、埋め込んだ HTML は画像だけ */
function figureLines(figure: MdmarkFigure, name: string): string {
  const alt = figure.title ?? `図 ${figure.index}`;
  const image = `![${alt}](${IMAGES_DIR}/${name})`;
  if (figure.kind === "html") {
    return image;
  }
  const legend =
    figure.legend.length >= 2
      ? ["", ...figure.legend.map((item) => `- ${item}`)]
      : [];
  return [`**${alt}**`, "", image, ...legend].join("\n");
}

/** 設定の `extensions` の拡張を Node で読み込んで登録する。読み込めない拡張は警告にして続ける */
export async function registerConfigExtensions(
  loaded: LoadedConfig,
): Promise<string[]> {
  resetExtensions();
  const warnings: string[] = [];
  for (const [position, path] of (loaded.config.extensions ?? []).entries()) {
    const where = `extensions[${position}] の ${path}`;
    const bundled = await bundleModule(path, loaded.dir, { build });
    if ("error" in bundled) {
      warnings.push(
        `${where} を読み込めないため、その拡張のマーカーを取り除きました（${bundled.error}）`,
      );
      continue;
    }
    try {
      const module = (await importBundledCode(bundled.code)) as {
        default?: MdmarkExtension;
      } | null;
      registerExtension(module?.default as MdmarkExtension);
    } catch (error) {
      warnings.push(
        `${where} を登録できないため、その拡張のマーカーを取り除きました（${reasonOf(error)}）`,
      );
    }
  }
  return warnings;
}

/** 設定の `extensions` を登録してから文書を純粋な Markdown にし、図の SVG を集めて、書き込まずにファイルの中身を返却する */
export async function exportMarkdownFiles(options: {
  /** 文書の絶対パス */
  file: string;
  /** 読み込んだ設定 */
  loaded: LoadedConfig;
  /** `dist/` の場所 */
  distDir: string;
}): Promise<{ markdown: string; images: ImageFile[]; warnings: string[] }> {
  const { file, loaded, distDir } = options;
  const { distCss } = await readDistAssets({ distDir, kind: "document" });
  const warnings = await registerConfigExtensions(loaded);
  const source = await readFile(file, "utf8");
  const { includes } = await collectIncludes({
    docPath: file,
    markdown: source,
    root: loaded.dir,
  });
  const images: ImageFile[] = [];
  const svgWarnings: string[] = [];
  const result = await toPureMarkdown(source, {
    config: loaded.config as MdmarkConfig,
    includes,
    figure: async (figure) => {
      const { svg, warnings: found } = await figureToSvg({
        figure,
        css: distCss,
        baseDir: dirname(file),
      });
      const name = `figure-${figure.index}.svg`;
      images.push({ name, svg });
      svgWarnings.push(
        ...found.map((warning) => `図 ${figure.index}: ${warning}`),
      );
      return figureLines(figure, name);
    },
  });
  return {
    markdown: result.markdown,
    images,
    warnings: [...warnings, ...result.warnings, ...svgWarnings],
  };
}

/** 出力のフォルダを書き込める状態にする。ファイルを指す・作れないときは `CliError` */
async function prepareDir(dir: string): Promise<void> {
  const unwritable = (reason: string): CliError =>
    new CliError(
      `書き込めない: ${dir} に書き込めません（${reason}）。--out で別のフォルダを指定してください。`,
    );
  const found = await stat(dir).catch(() => undefined);
  if (found !== undefined && !found.isDirectory()) {
    throw unwritable("同じ名前のファイルがあります");
  }
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    throw unwritable(reasonOf(error));
  }
}

/** 出力のフォルダに、`images/` を空にしてから SVG を、最後に Markdown を書き込む */
export async function writeMarkdownFiles(options: {
  /** 出力のフォルダ */
  dir: string;
  /** Markdown のファイル名（拡張子を除く） */
  name: string;
  /** Markdown */
  markdown: string;
  /** `images/` に置く SVG */
  images: ImageFile[];
}): Promise<{ markdown: string; images: string[] }> {
  const { dir, name, markdown, images } = options;
  await prepareDir(dir);
  const imagesDir = join(dir, IMAGES_DIR);
  const markdownFile = join(dir, `${name}.md`);
  try {
    await rm(imagesDir, { recursive: true, force: true });
    if (images.length > 0) {
      await mkdir(imagesDir, { recursive: true });
    }
    for (const image of images) {
      await writeFile(join(imagesDir, image.name), image.svg);
    }
    await writeFile(markdownFile, markdown);
  } catch (error) {
    throw new CliError(
      `書き込めない: ${dir} に書き込めません（${reasonOf(error)}）。--out で別のフォルダを指定してください。`,
    );
  }
  return {
    markdown: markdownFile,
    images: images.map((image) => join(imagesDir, image.name)),
  };
}

/** 設定と文書を読み込み、Markdown と SVG を書き込んで、警告と書き出したファイルを出す */
export async function runExportMarkdown(
  options: {
    /** 書き出す文書のパス */
    file: string;
    /** 出力のフォルダ */
    out?: string | undefined;
    /** 使用する設定ファイルのパス */
    config?: string | undefined;
    /** `dist/` の場所 */
    distDir: string;
  },
  io: CliIo,
): Promise<0> {
  const loaded = await requireConfig(io.cwd, options.config);
  const file = resolve(io.cwd, options.file);
  try {
    await readFile(file);
  } catch {
    throw new CliError(
      `文書が無い: ${options.file} が見つかりません。文書のパスを修正してください。`,
    );
  }
  const defaults = markdownOutDir(file);
  const dir =
    options.out === undefined ? defaults.dir : resolve(io.cwd, options.out);
  const { markdown, images, warnings } = await exportMarkdownFiles({
    file,
    loaded,
    distDir: options.distDir,
  });
  const written = await writeMarkdownFiles({
    dir,
    name: defaults.name,
    markdown,
    images,
  });
  for (const warning of warnings) {
    io.stderr(`警告: ${warning}`);
  }
  io.stdout(
    `書き出した: ${toPosix(relative(io.cwd, written.markdown))} （SVG ${written.images.length} 件）`,
  );
  return 0;
}
