import { readFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { build, transform } from "esbuild";
import {
  BROWSER_TARGETS,
  cacheFetchText,
  type FetchText,
  urlPlugin,
} from "../bundle-module.ts";

export { cacheFetchText, type FetchText };

import MarkdownIt from "markdown-it";
import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { resolveLink } from "../knowledge/paths.ts";
import { renderDocument } from "../render/index.ts";
import { MARK_PATTERN } from "../render/marks.ts";
import { mediaKindOf } from "../render/syntax/images.ts";
import { collectRangeScripts } from "../render/used.ts";
import { findAssetRefs, resolveAssetFile } from "./assets.ts";
import { ASSET_SCHEME } from "./html.ts";
import { HTML_SCRIPT_KEY_PREFIX, hideScript } from "./traces.ts";

export { usedSyntaxLanguages, usesMermaid } from "../render/used.ts";

/** 画像の拡張子から MIME を参照する表 */
const IMAGE_MIME: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** スキームを持つ URL か（`//` で始まる URL を含む） */
const EXTERNAL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** 埋める文書にビューのマーカーがあれば `true` を返却する。書き出した HTML はコメントの読み込みと保存の関数を持たないため、コメントの部品はまとめない */
export function usedParts(options: {
  /** 埋める文書の Markdown */
  markdowns: string[];
}): boolean {
  return options.markdowns.some((markdown) =>
    [...markdown.matchAll(MARK_PATTERN)].some(
      ([, closing, name]) => closing !== "/" && name === "view",
    ),
  );
}

/** まとめたコードに残った動的 `import()` の呼び出しの並び（`import` と `(` の間の空白を許す） */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(/;

/** まとめたコードに動的 `import()` の呼び出しが残るかを返却する。変数を指定する `import()` は esbuild が取り込めず、まとめた後も残る */
export function hasDynamicImport(code: string): boolean {
  return DYNAMIC_IMPORT_PATTERN.test(code);
}

/** `prepareEmbeds` がまとめられることを確認した、起動の処理と 1 つのスクリプトにまとめるモジュールの読み込み先（URL か絶対パス） */
export type ViewerEmbeds = {
  /** 文書にマーカーがありまとめられた外部ライブラリの、マーカーの名前から読み込み先を参照する表 */
  libraries: Record<string, string>;
  /** まとめられた設定の `extensions` の拡張の読み込み先。設定の順 */
  extensions: string[];
  /** まとめられた色分けの本体の読み込み先と、言語のモジュール名から読み込み先を参照する表。文書に色分けの対象があり本体をまとめられたときだけ持つ */
  syntax?: { core: string; languages: Record<string, string> } | undefined;
  /** まとめられた mermaid の読み込み先。文書に mermaid のコードブロックがあり、まとめられたときだけ持つ */
  mermaid?: string | undefined;
  /** ビューの部品をまとめるか */
  view: boolean;
  /** map の部品（`dist/map.js`）をまとめるか */
  map?: boolean | undefined;
  /** `compileHtmlScripts` の結果。`source` は範囲のコードの文字、`code` は CommonJS のコード。範囲が無ければ入れない */
  htmlScripts?: Array<{ source: string; code: string }> | undefined;
};

/** 文書ごとに `collectRangeScripts` で範囲の `ts`・`js` を集め、esbuild の `transform` で CommonJS に変える。同じコードは 1 回だけ変え、変えられない範囲は警告にする */
export async function compileHtmlScripts(options: {
  /** 書き出す文書 */
  documents: Array<{ path: string; markdown: string }>;
  /** 設定 */
  config: MdmarkConfig;
}): Promise<{
  scripts: Array<{ source: string; code: string }>;
  warnings: string[];
}> {
  const scripts: Array<{ source: string; code: string }> = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const { path, markdown } of options.documents) {
    for (const { lang, source } of collectRangeScripts({
      markdown,
      config: options.config,
    })) {
      if (seen.has(source)) {
        continue;
      }
      seen.add(source);
      try {
        const { code } = await transform(source, {
          loader: lang,
          format: "cjs",
        });
        scripts.push({ source, code });
      } catch (error) {
        const reason = String(
          error instanceof Error ? error.message : error,
        ).split("\n")[0];
        warnings.push(
          `${path}: 範囲の ${lang} を変換できません（${reason}）。開いたときは記載の警告になります。`,
        );
      }
    }
  }
  return { scripts, warnings };
}

/** map の範囲の要素 */
const MAP_PATTERN = /<div\b[^>]*\sclass="mdmark-map"/;

/** 文書ごとに `render` を設定と一緒に呼び、返った HTML に `div.mdmark-map` があれば `true` を返す。`prepareEmbeds` が `embeds.map` に入れる */
export function usesMap(options: {
  /** 埋める文書の Markdown */
  markdowns: string[];
  /** 読み込んだ設定 */
  config: MdmarkConfig;
}): boolean {
  const config = resolveConfig({ config: options.config });
  return options.markdowns.some((markdown) =>
    MAP_PATTERN.test(renderDocument({ markdown, config }).html),
  );
}

/** 起動の処理・部品・色分けを静的な `import`、外部ライブラリと拡張をリテラルの動的 `import()` を返却する関数で取り込み、`startViewer(document, 埋めたモジュール)` を呼ぶ入口のモジュールのソースを返却する */
export function createViewerEntry(options: {
  /** `dist/viewer.js` の絶対パス */
  viewer: string;
  /** `dist/view.js` の絶対パス */
  view: string;
  /** `dist/map.js` の絶対パス。`embeds.map` のときだけ読み込む */
  map?: string | undefined;
  /** まとめるモジュールの読み込み先 */
  embeds: ViewerEmbeds;
  /** 範囲のスクリプトの表の鍵を、`bundleViewer` が隠した後に戻す仮の文字列で記載するか */
  hideTraces?: boolean | undefined;
}): string {
  const { viewer, view, embeds } = options;
  const literal = (value: string): string => JSON.stringify(value);
  const lines = [`import { startViewer } from ${literal(viewer)};`];
  if (embeds.view) {
    lines.push(`import * as viewPart from ${literal(view)};`);
  }
  if (embeds.map && options.map !== undefined) {
    lines.push(`import * as mapPart from ${literal(options.map)};`);
  }
  const parts = [
    ...(embeds.view ? ["view: viewPart"] : []),
    ...(embeds.map && options.map !== undefined ? ["map: mapPart"] : []),
  ];
  const languages = Object.entries(embeds.syntax?.languages ?? {});
  if (embeds.syntax) {
    lines.push(`import syntaxCore from ${literal(embeds.syntax.core)};`);
    languages.forEach(([, path], position) => {
      lines.push(`import syntaxLanguage${position} from ${literal(path)};`);
    });
  }
  if (embeds.mermaid) {
    // mermaid が中で読み込む chunk の動的 `import()` も、同じスクリプトに取り込まれる
    lines.push(`import * as mermaidModule from ${literal(embeds.mermaid)};`);
  }
  const lazy = (path: string): string => `() => import(${literal(path)})`;
  const libraries = Object.entries(embeds.libraries)
    .map(([name, path]) => `${literal(name)}: ${lazy(path)}`)
    .join(", ");
  const extensions = embeds.extensions.map(lazy).join(", ");
  const syntax = embeds.syntax
    ? `, syntax: { core: { default: syntaxCore }, languages: { ${languages
        .map(
          ([name], position) =>
            `${literal(name)}: { default: syntaxLanguage${position} }`,
        )
        .join(", ")} } }`
    : "";
  // 範囲のスクリプトは、範囲のコードの文字を鍵に、CommonJS のコードを包んだ関数で既定のエクスポートを返却する
  const htmlScripts = embeds.htmlScripts?.length
    ? `, htmlScripts: new Map([${embeds.htmlScripts
        .map(
          ({ source, code }, position) =>
            `[${literal(options.hideTraces ? `${HTML_SCRIPT_KEY_PREFIX}${position}@@` : source)}, () => { const module = { exports: {} }; (function (module, exports, require) {\n${code}\n})(module, module.exports, (name) => { throw new Error("範囲のスクリプトでは require を使用できません: " + name); }); return module.exports.default; }]`,
        )
        .join(", ")}])`
    : "";
  lines.push(
    `startViewer(document, { parts: ${parts.length > 0 ? `{ ${parts.join(", ")} }` : "{}"}${syntax}${embeds.mermaid ? ", mermaid: mermaidModule" : ""}, libraries: { ${libraries} }, extensions: [${extensions}]${htmlScripts} });`,
  );
  return `${lines.join("\n")}\n`;
}

/** `createViewerEntry` のソースを入口に、分割せずに 1 つの ES モジュールのスクリプトにまとめ、`</script` を `<\/script` に、`<!--` を `<\x21--` に替えて返却する。まとめる失敗は例外のまま投げる */
export async function bundleViewer(options: {
  /** `createViewerEntry` のソース */
  entry: string;
  /** 設定ファイルのあるフォルダ */
  baseDir: string;
  /** URL を読み込む関数 */
  fetchText: FetchText;
  /** 隠すときだけ指定する。`keys` は `createViewerEntry` に指定した範囲のスクリプトの `source` の並び */
  hideTraces?: { keys: string[] } | undefined;
}): Promise<string> {
  const { entry, baseDir, fetchText } = options;
  const result = await build({
    absWorkingDir: baseDir,
    stdin: { contents: entry, resolveDir: baseDir, loader: "js" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: BROWSER_TARGETS,
    minify: true,
    write: false,
    outfile: "viewer.js",
    plugins: [urlPlugin(fetchText)],
    logLevel: "silent",
  });
  const bundled = result.outputFiles[0]?.text;
  if (bundled === undefined) {
    throw new Error("起動の処理をまとめた結果がありません");
  }
  const code = options.hideTraces
    ? hideScript({ code: bundled, keys: options.hideTraces.keys })
    : bundled;
  // `script` 要素が途中で閉じない・script data escaped state に入らないように替える（どちらも文字列・正規表現・コメントの中にしか現れない）
  return code.replace(/<\/(script)/gi, "<\\/$1").replaceAll("<!--", "<\\x21--");
}

/** Markdown の画像の場所の一覧: その場所を含む行の範囲と、`src` の文字 */
function findImageSources(
  markdown: string,
): Array<{ start: number; end: number; src: string }> {
  const tokens = new MarkdownIt({ html: true }).parse(markdown, {});
  const found: Array<{ start: number; end: number; src: string }> = [];
  for (const token of tokens) {
    if (!token.map) {
      continue;
    }
    const [start, end] = token.map;
    const sources: string[] = [];
    for (const child of token.children ?? []) {
      if (child.type === "image") {
        const src = child.attrGet("src");
        sources.push(typeof src === "string" ? src : "");
      } else if (child.type === "html_inline") {
        sources.push(...imgSources(child.content));
      }
    }
    if (token.type === "html_block") {
      sources.push(...imgSources(token.content));
    }
    for (const src of sources) {
      if (src !== "") {
        found.push({ start, end, src });
      }
    }
  }
  return found;
}

/** HTML の文字列の `img` の `src` を取得する */
function imgSources(html: string): string[] {
  return [
    ...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),
  ].map((match) => match[1] ?? match[2] ?? "");
}

/** Markdown の画像の相対パス（画像の属性の `poster=` を含む）を、文書のフォルダか `assetsRoot` で探して読み込んだ `data:` URL に替える（フラグメントは後ろに残す）。`assets` を指定したときは `mdmark-asset:{キー}` に替え、`data:` URL を `assets` に入れる。動画・音声は替えない。読み込めない画像は記載したまま残して警告に、絶対 URL の画像は読み込まずに残して警告にする */
export async function inlineImages(
  markdown: string,
  docFile: string,
  options: {
    /** `assets.root` の絶対パス */
    assetsRoot?: string | undefined;
    /** `build` が文書をまたいで共有する、埋めた画像のファイルからキーと `data:` URL を参照する表 */
    assets?: Map<string, { key: string; url: string }>;
  } = {},
): Promise<{ markdown: string; warnings: string[] }> {
  const warnings: string[] = [];
  const warned = new Set<string>();
  for (const { src } of findImageSources(markdown)) {
    const media = ["video", "audio"].includes(mediaKindOf(src));
    if (isAbsoluteSrc(src) && !media && !warned.has(src)) {
      warned.add(src);
      warnings.push(
        `画像 \`${src}\` は絶対 URL のため埋めません。開いたときに外へ要求します。`,
      );
    }
  }
  // 同じ `src` は 1 回だけ読み込む
  const urls = new Map<string, string | undefined>();
  const replacements: Array<{ offset: number; src: string; to: string }> = [];
  for (const ref of findAssetRefs(markdown)) {
    if (ref.kind !== "image" && ref.kind !== "poster") {
      continue;
    }
    if (!urls.has(ref.src)) {
      urls.set(ref.src, await readImage(ref.src, docFile, options, warnings));
    }
    const url = urls.get(ref.src);
    if (url !== undefined && ref.offset >= 0) {
      replacements.push({
        offset: ref.offset,
        src: ref.src,
        to: `${url}${fragmentOf(ref.src)}`,
      });
    }
  }
  let result = markdown;
  for (const { offset, src, to } of replacements.reverse()) {
    result = `${result.slice(0, offset)}${to}${result.slice(offset + src.length)}`;
  }
  return { markdown: result, warnings };
}

/** 埋めない絶対 URL の画像か（`data:` を除く） */
function isAbsoluteSrc(src: string): boolean {
  return (
    !src.startsWith("data:") &&
    (EXTERNAL_PATTERN.test(src) || src.startsWith("/"))
  );
}

/** 記載したパスのフラグメント（`#` から後ろ） */
function fragmentOf(src: string): string {
  const at = src.indexOf("#");
  return at < 0 ? "" : src.slice(at);
}

/** 画像 1 つを探して読み込み、`data:` URL（`assets` を指定したときは `mdmark-asset:{キー}`）にする。埋められないときは理由を `warnings` に追加して `undefined` を返却する */
async function readImage(
  src: string,
  docFile: string,
  options: {
    assetsRoot?: string | undefined;
    assets?: Map<string, { key: string; url: string }>;
  },
  warnings: string[],
): Promise<string | undefined> {
  const mime = IMAGE_MIME[extname(src.split(/[?#]/)[0] ?? "").toLowerCase()];
  if (mime === undefined) {
    warnings.push(
      `画像 \`${src}\` は埋められない形式です。png・jpg・jpeg・gif・webp・svg にしてください。`,
    );
    return undefined;
  }
  const file = await resolveAssetFile(src, {
    docDir: dirname(docFile),
    assetsRoot: options.assetsRoot,
  });
  const shared = file === undefined ? undefined : options.assets?.get(file);
  if (shared) {
    return `${ASSET_SCHEME}${shared.key}`;
  }
  try {
    if (file === undefined) {
      throw new Error("not found");
    }
    const bytes = await readFile(file);
    const url = `data:${mime};base64,${bytes.toString("base64")}`;
    if (options.assets === undefined) {
      return url;
    }
    const key = String(options.assets.size + 1);
    options.assets.set(file, { key, url });
    return `${ASSET_SCHEME}${key}`;
  } catch {
    warnings.push(
      `画像 \`${src}\` を読み込めません。パスを修正するか画像を配置してください。`,
    );
    return undefined;
  }
}

/** パーセント符号化を戻す。戻せないときはそのまま返却する */
function decodeHref(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

/** 文書の相対リンクのうち、`.md` を指してまとめる文書に無いものを、記載したままの `href` で記載した順に返却する */
export function findOutsideLinks(
  markdown: string,
  docPath: string,
  paths: ReadonlySet<string>,
): string[] {
  const tokens = new MarkdownIt({ html: true }).parse(markdown, {});
  const outside: string[] = [];
  for (const token of tokens) {
    for (const child of token.children ?? []) {
      const href = child.type === "link_open" ? child.attrGet("href") : null;
      if (typeof href !== "string" || href.startsWith("#")) {
        continue;
      }
      const target = resolveLink(docPath, href);
      // markdown-it が符号化したリンクを、記載したままの構造に戻す
      const written = decodeHref(href);
      if (
        target !== undefined &&
        extname(target) === ".md" &&
        !paths.has(target) &&
        !outside.includes(written)
      ) {
        outside.push(written);
      }
    }
  }
  return outside;
}
