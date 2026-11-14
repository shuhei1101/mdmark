import { copyFile, mkdir, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import { ATTACHMENT_KINDS } from "../render/syntax/cards.ts";
import { mediaKindOf } from "../render/syntax/images.ts";
import type { CheckIssue } from "./check.ts";
import { CliError } from "./errors.ts";

/** 文書が相対パスで指すファイル 1 つ */
export type AssetRef = {
  /** 記載したパス（クエリとフラグメントを含む） */
  src: string;
  /** 種類（GIF は `image`） */
  kind: "image" | "video" | "audio" | "poster" | "attachment";
  /** 記載した行の番号（1 から） */
  line: number;
};

/** 記載した場所の分かるファイルの参照。`offset` は Markdown の頭からの位置（見つからなければ `-1`） */
export type LocatedAssetRef = AssetRef & { offset: number };

/** スキームを持つ URL か（`//` で始まる URL を含む） */
const EXTERNAL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** 画像の直後の `{…}` の `poster=` の値 */
const POSTER_PATTERN = /^\{(?:[^{}]*\s)?poster=([^\s}]+)[^{}]*\}/;

/** HTML の文字列の `img` の `src` */
const IMG_SRC_PATTERN = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** 点検の本文に出す種類の名前 */
const KIND_LABELS: Readonly<Record<AssetRef["kind"], string>> = {
  image: "画像",
  video: "動画",
  audio: "音声",
  poster: "画像",
  attachment: "添付",
};

/** 相対パスの参照か（絶対 URL・`data:`・`#`・`/` で始まるものを除く） */
function isRelative(src: string): boolean {
  return (
    src !== "" &&
    !EXTERNAL_PATTERN.test(src) &&
    !src.startsWith("#") &&
    !src.startsWith("/")
  );
}

/** クエリとフラグメントを除いたパスの拡張子（小文字。`.` を含まない） */
function extensionOf(src: string): string {
  return extname(src.split(/[?#]/, 1)[0] ?? "")
    .slice(1)
    .toLowerCase();
}

/** 画像の `src` の種類を参照の種類にする */
function refKindOf(src: string): AssetRef["kind"] {
  const kind = mediaKindOf(src);
  return kind === "video" || kind === "audio" ? kind : "image";
}

/** 本文の位置から行（1 から）を返却する関数 */
function lineFinder(markdown: string): {
  lineStarts: number[];
  lineOf: (offset: number) => number;
} {
  const lineStarts = [0];
  for (const [index, char] of [...markdown].entries()) {
    if (char === "\n") {
      lineStarts.push(index + 1);
    }
  }
  const lineOf = (offset: number): number => {
    let line = 0;
    while (
      line + 1 < lineStarts.length &&
      (lineStarts[line + 1] ?? 0) <= offset
    ) {
      line += 1;
    }
    return line + 1;
  };
  return { lineStarts, lineOf };
}

/** 画像の `src`。直後の文字に動画の `poster` があれば、それも加える */
function imageSources(
  children: Token[],
  position: number,
): Array<{ src: string; kind: AssetRef["kind"] }> {
  const child = children[position] as Token;
  const src = String(child.attrGet("src") ?? "");
  const next = children[position + 1];
  const poster =
    next?.type === "text" ? POSTER_PATTERN.exec(next.content)?.[1] : undefined;
  return [
    { src, kind: refKindOf(src) },
    ...(poster === undefined ? [] : [{ src: poster, kind: "poster" as const }]),
  ];
}

/** 行内の子 1 つが参照するファイル: 画像・添付のリンク・行内の HTML の `img` */
function childSources(
  children: Token[],
  position: number,
): Array<{ src: string; kind: AssetRef["kind"] }> {
  const child = children[position] as Token;
  if (child.type === "image") {
    return imageSources(children, position);
  }
  if (child.type === "link_open") {
    const href = String(child.attrGet("href") ?? "");
    return ATTACHMENT_KINDS[extensionOf(href)] === undefined
      ? []
      : [{ src: href, kind: "attachment" }];
  }
  if (child.type === "html_inline") {
    return imgSources(child.content).map((src) => ({
      src,
      kind: "image" as const,
    }));
  }
  return [];
}

/** トークンが参照するファイル（行内の子の順、HTML のブロックの `img` は最後） */
function tokenSources(
  token: Token,
): Array<{ src: string; kind: AssetRef["kind"] }> {
  const children = token.children ?? [];
  const sources = children.flatMap((_, position) =>
    childSources(children, position),
  );
  if (token.type === "html_block") {
    sources.push(
      ...imgSources(token.content).map((src) => ({
        src,
        kind: "image" as const,
      })),
    );
  }
  return sources;
}

/** markdown-it のトークンから相対パスの参照を、記載した場所つきで記載した順に返却する */
export function findAssetRefs(markdown: string): LocatedAssetRef[] {
  const tokens = new MarkdownIt({ html: true }).parse(markdown, {});
  const { lineStarts, lineOf } = lineFinder(markdown);
  const refs: LocatedAssetRef[] = [];
  for (const token of tokens) {
    if (!token.map) {
      continue;
    }
    const [startLine] = token.map;
    let cursor = lineStarts[startLine] ?? 0;
    for (const { src: parsed, kind } of tokenSources(token)) {
      if (!isRelative(parsed)) {
        continue;
      }
      // markdown-it が符号化した `src` は、記載したままの構造に戻して探す
      const src = [parsed, decodeSrc(parsed)].find(
        (candidate) => markdown.indexOf(candidate, cursor) >= 0,
      );
      const at = src === undefined ? -1 : markdown.indexOf(src, cursor);
      if (src !== undefined) {
        cursor = at + src.length;
      }
      const line = at >= 0 ? lineOf(at) : startLine + 1;
      refs.push({ src: src ?? parsed, kind, line, offset: at });
    }
  }
  return refs;
}

/** HTML の文字列の `img` の `src` を取得する */
function imgSources(html: string): string[] {
  return [...html.matchAll(IMG_SRC_PATTERN)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

/** 文書が相対パスで指す画像・動画・音声・`poster`・添付のファイルを、記載した順に返却する */
export function collectAssetRefs(markdown: string): AssetRef[] {
  return findAssetRefs(markdown).map(({ src, kind, line }) => ({
    src,
    kind,
    line,
  }));
}

/** パーセント符号化を戻す。戻せないときはそのまま返却する */
function decodeSrc(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}

/** パーセント符号化を戻したパス（クエリとフラグメントを除く） */
function pathOf(src: string): string {
  return decodeSrc(src.split(/[?#]/, 1)[0] ?? "");
}

/** 記載したパスを文書のフォルダで探し、無ければ `assetsRoot` で探して、見つかったファイルの絶対パスを返却する */
export async function resolveAssetFile(
  src: string,
  options: { docDir: string; assetsRoot?: string | undefined },
): Promise<string | undefined> {
  const path = pathOf(src);
  const roots =
    options.assetsRoot === undefined
      ? [options.docDir]
      : [options.docDir, options.assetsRoot];
  for (const root of roots) {
    const file = resolve(root, path);
    try {
      if ((await stat(file)).isFile()) {
        return file;
      }
    } catch {
      // 無いときは次の場所で探す
    }
  }
  return undefined;
}

/** 記載したパスのクエリとフラグメント（`?` か `#` から後ろ） */
function suffixOf(src: string): string {
  const at = src.search(/[?#]/);
  return at < 0 ? "" : src.slice(at);
}

/** パスの区切りを `/` にする */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** `_files/` の中のコピー先のパス。基準の外のファイルは `external/{名前}` にし、使用しているパスと重なれば `-1`・`-2` を付ける */
function copyTargetOf(
  file: string,
  baseDir: string,
  used: ReadonlySet<string>,
): string {
  const inside = relative(baseDir, file);
  if (inside !== "" && !inside.startsWith("..") && !isAbsolute(inside)) {
    return toPosix(inside);
  }
  const extension = extname(file);
  const stem = basename(file, extension);
  let name = `external/${stem}${extension}`;
  for (let count = 1; used.has(name); count += 1) {
    name = `external/${stem}-${count}${extension}`;
  }
  return name;
}

/** ファイルを `_files/` へコピーし、`_files/` の中のパスを返却する。この書き出しでコピー済みのファイルはコピーしない */
async function copyOnce(options: {
  file: string;
  baseDir: string;
  filesDir: string;
  copied: Map<string, string>;
}): Promise<string> {
  const { file, baseDir, filesDir, copied } = options;
  const known = copied.get(file);
  if (known !== undefined) {
    return known;
  }
  const target = copyTargetOf(file, baseDir, new Set(copied.values()));
  const dest = join(filesDir, ...target.split("/"));
  try {
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(file, dest);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `${filesDir} に書き込めません（${reason}）。出力先のフォルダを確認してください。`,
    );
  }
  copied.set(file, target);
  return target;
}

/** 文書の動画と音声を `{出力の名前}_files/` へコピーし、Markdown の `src` を HTML からの相対パスに替える。`copied` のファイルはコピーせず同じパスを使用する */
export async function copyMedia(options: {
  /** 文書の Markdown */
  markdown: string;
  /** 文書の絶対パス */
  docFile: string;
  /** `assets.root` の絶対パス */
  assetsRoot?: string | undefined;
  /** コピー先の中のパスの基準（設定ファイルのフォルダ。無ければ文書のフォルダ） */
  baseDir: string;
  /** 出力の HTML の絶対パス */
  out: string;
  /** この書き出しでコピーしたファイルから `_files/` の中のパスを参照する表（文書をまたいで共有する） */
  copied: Map<string, string>;
}): Promise<{ markdown: string; warnings: string[] }> {
  const { markdown, docFile, assetsRoot, baseDir, out, copied } = options;
  const filesName = `${basename(out, extname(out))}_files`;
  const filesDir = join(dirname(out), filesName);
  const warnings: string[] = [];
  const replacements: Array<{ offset: number; src: string; to: string }> = [];
  const media = findAssetRefs(markdown).filter(
    (ref) => ref.kind === "video" || ref.kind === "audio",
  );
  for (const ref of media) {
    const file = await resolveAssetFile(ref.src, {
      docDir: dirname(docFile),
      assetsRoot,
    });
    if (file === undefined) {
      warnings.push(
        `${KIND_LABELS[ref.kind]} \`${ref.src}\` を読み込めません。パスを修正するかファイルを配置してください。`,
      );
      continue;
    }
    const target = await copyOnce({ file, baseDir, filesDir, copied });
    if (ref.offset >= 0) {
      replacements.push({
        offset: ref.offset,
        src: ref.src,
        to: `${filesName}/${target}${suffixOf(ref.src)}`,
      });
    }
  }
  let result = markdown;
  for (const { offset, src, to } of replacements.reverse()) {
    result = `${result.slice(0, offset)}${to}${result.slice(offset + src.length)}`;
  }
  return { markdown: result, warnings };
}

/** 文書の参照のうち、文書のフォルダにも `assets.root` にも無いものを `missing_file` のずれにする */
export async function checkMissingFiles(options: {
  /** 文書の Markdown */
  markdown: string;
  /** 文書の絶対パス */
  docFile: string;
  /** ずれに出す文書の相対パス */
  file: string;
  /** `assets.root` の絶対パス */
  assetsRoot?: string | undefined;
}): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  for (const ref of collectAssetRefs(options.markdown)) {
    const found = await resolveAssetFile(ref.src, {
      docDir: dirname(options.docFile),
      assetsRoot: options.assetsRoot,
    });
    if (found === undefined) {
      issues.push({
        file: options.file,
        where: String(ref.line),
        kind: "missing_file",
        message: `${KIND_LABELS[ref.kind]}のファイル \`${ref.src}\` が見つかりません。パスを修正するか、文書のフォルダか \`assets.root\` のフォルダにファイルを配置してください。`,
      });
    }
  }
  return issues;
}
