import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { build, type Plugin } from "esbuild";
import MarkdownIt from "markdown-it";
import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { resolveLink } from "../knowledge/paths.ts";
import { SYNTAX_ATTRIBUTE } from "../parts/code-block.ts";
import { renderDocument } from "../render/index.ts";
import { MARK_PATTERN } from "../render/marks.ts";

/** URL を読む関数 */
export type FetchText = (url: string) => Promise<string>;

/** 束ねたモジュールの target に渡すブラウザの版（対応ブラウザの下限） */
const BROWSER_TARGETS = ["chrome99", "firefox98", "safari16.4"];

/** esbuild が URL の import を読む名前空間 */
const URL_NAMESPACE = "http-url";

/** 画像の拡張子から MIME を引く表 */
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

/** `http:`・`https:` の URL か */
const HTTP_PATTERN = /^https?:\/\//i;

/** `fetch` で URL の本文を読む。読めなければ例外を投げる */
const fetchByUrl: FetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} は ${response.status} を返しました`);
  }
  return response.text();
};

/** 文書の Markdown から印の名前を拾い、対応表にあるものだけを返す */
export function usedLibraryMarks(
  markdowns: string[],
  libraries: Record<string, string>,
): Set<string> {
  const marks = new Set<string>();
  for (const markdown of markdowns) {
    for (const match of markdown.matchAll(MARK_PATTERN)) {
      const [, closing, name] = match;
      if (closing !== "/" && name && Object.hasOwn(libraries, name)) {
        marks.add(name);
      }
    }
  }
  return marks;
}

/** 色分けの対象の `code` が持つ属性から、言語のモジュール名を読む正規表現 */
const SYNTAX_LANGUAGE_PATTERN = new RegExp(
  `<code\\b[^>]*\\s${SYNTAX_ATTRIBUTE}="([^"]*)"`,
  "g",
);

/** 文書ごとに `render` を設定と一緒に呼び、返った HTML の色分けの属性の値を、重なりなく名前の順に返す。`mount` と同じ色分けの対象（機能 `syntax` と文書の `<!-- features: -syntax -->`、生の HTML の `code` を外すことを含む）を、同じ処理から得る */
export function usedSyntaxLanguages(options: {
  /** 文書の Markdown */
  markdowns: string[];
  /** 読んだ設定 */
  config: MdmarkConfig;
}): string[] {
  const config = resolveConfig({ config: options.config });
  const languages = new Set<string>();
  for (const markdown of options.markdowns) {
    const { html } = renderDocument({ markdown, config });
    for (const match of html.matchAll(SYNTAX_LANGUAGE_PATTERN)) {
      if (match[1]) {
        languages.add(match[1]);
      }
    }
  }
  return [...languages].sort();
}

/** 埋める文書にビューの印があれば、埋める部品のモジュールのコードを入れた表を返す。無ければ空。書き出した HTML はコメントの読み書きの関数を持たないため、コメントの部品は埋めない */
export function usedParts(options: {
  /** 埋める文書の Markdown */
  markdowns: string[];
  /** `dist/view.js` のコード */
  view: string;
}): Partial<Record<"view", string>> {
  const { markdowns, view } = options;
  const found = markdowns.some((markdown) =>
    [...markdown.matchAll(MARK_PATTERN)].some(
      ([, closing, name]) => closing !== "/" && name === "view",
    ),
  );
  return found ? { view } : {};
}

/** URL の import を `fetchText` で読んで束ねる esbuild のプラグイン。取得したモジュールの中の import は、そのモジュールの URL を基準に解く */
function urlPlugin(fetchText: FetchText): Plugin {
  return {
    name: "http-url",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^https?:\/\// }, (args) => ({
        path: args.path,
        namespace: URL_NAMESPACE,
      }));
      pluginBuild.onResolve(
        { filter: /.*/, namespace: URL_NAMESPACE },
        (args) => ({
          path: new URL(args.path, args.importer).href,
          namespace: URL_NAMESPACE,
        }),
      );
      pluginBuild.onLoad(
        { filter: /.*/, namespace: URL_NAMESPACE },
        async (args) => ({
          contents: await fetchText(args.path),
          loader: "js",
        }),
      );
    },
  };
}

/** URL かファイルのモジュールを、import する先も含めて 1 つの ES モジュールのコードに束ねる。届かない・束ねられないときは例外を投げずに理由を返す */
export async function bundleModule(
  entry: string,
  baseDir: string,
  fetchText: FetchText = fetchByUrl,
): Promise<{ code: string } | { error: string }> {
  try {
    const result = await build({
      absWorkingDir: baseDir,
      entryPoints: [HTTP_PATTERN.test(entry) ? entry : resolve(baseDir, entry)],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: BROWSER_TARGETS,
      minify: true,
      write: false,
      outfile: "bundle.js",
      plugins: [urlPlugin(fetchText)],
      logLevel: "silent",
    });
    const code = result.outputFiles[0]?.text;
    if (code === undefined) {
      return { error: `${entry}: 束ねた結果がありません` };
    }
    return { code };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { error: `${entry}: ${reason}` };
  }
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

/** HTML の文字列の `img` の `src` を拾う */
function imgSources(html: string): string[] {
  return [
    ...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),
  ].map((match) => match[1] ?? match[2] ?? "");
}

/** Markdown の画像の相対パスを、文書のフォルダを基準に読んだ `data:` URL に替える。読めない画像は書いたまま残して警告に、絶対 URL の画像は読まずに残して警告にする */
export async function inlineImages(
  markdown: string,
  docFile: string,
): Promise<{ markdown: string; warnings: string[] }> {
  const lines = markdown.split("\n");
  const warnings: string[] = [];
  // 同じ `src` は 1 回だけ読む
  const dataUrls = new Map<string, string | undefined>();
  for (const { start, end, src } of findImageSources(markdown)) {
    if (src.startsWith("data:")) {
      continue;
    }
    if (!dataUrls.has(src)) {
      dataUrls.set(src, await readImage(src, docFile, warnings));
    }
    const dataUrl = dataUrls.get(src);
    if (dataUrl === undefined) {
      continue;
    }
    for (let line = start; line < end; line += 1) {
      lines[line] = (lines[line] ?? "").replaceAll(src, dataUrl);
    }
  }
  return { markdown: lines.join("\n"), warnings };
}

/** 画像 1 つを読んで `data:` URL にする。埋められないときは理由を `warnings` に足して `undefined` を返す */
async function readImage(
  src: string,
  docFile: string,
  warnings: string[],
): Promise<string | undefined> {
  if (EXTERNAL_PATTERN.test(src) || src.startsWith("/")) {
    warnings.push(
      `画像 \`${src}\` は絶対 URL のため埋めません。開いたときに外へ要求します。`,
    );
    return undefined;
  }
  const mime = IMAGE_MIME[extname(src.split(/[?#]/)[0] ?? "").toLowerCase()];
  if (mime === undefined) {
    warnings.push(
      `画像 \`${src}\` は埋められない形式です。png・jpg・jpeg・gif・webp・svg にしてください。`,
    );
    return undefined;
  }
  let decoded = src;
  try {
    decoded = decodeURI(src);
  } catch {
    // 戻せないときは、そのまま読む
  }
  try {
    const bytes = await readFile(resolve(dirname(docFile), decoded));
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    warnings.push(
      `画像 \`${src}\` を読めません。パスを直すか画像を置いてください。`,
    );
    return undefined;
  }
}

/** パーセント符号化を戻す。戻せないときはそのまま返す */
function decodeHref(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

/** 文書の相対リンクのうち、`.md` を指してまとめる文書に無いものを、書いたままの `href` で書いた順に返す */
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
      // markdown-it が符号化したリンクを、書いたままの形に戻す
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
