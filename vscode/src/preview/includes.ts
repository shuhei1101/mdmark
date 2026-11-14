import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** `/` で区切ったパスの `.`・`..` を解く。先頭から上へ出る `..` は残す */
const normalizePath = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
};

/** ライブラリ本体の `resolveIncludePath` と同じ解き方で、マーカーを記載した文書のフォルダを基準に、取り込み先を開いている Markdown のフォルダからのパスにする（拡張機能は単独でまとめるため、ライブラリ本体を読み込まない） */
const includeKey = (from: string, written: string): string => {
  const hash = written.indexOf("#");
  const path = hash < 0 ? written : written.slice(0, hash);
  const slash = from.lastIndexOf("/");
  const dir = slash < 0 ? "" : from.slice(0, slash);
  return normalizePath(dir ? `${dir}/${path}` : path);
};

/** 行頭から記載した include のマーカー */
const MARKER_PATTERN = /^\s{0,3}<!--\s*include:\s*(.*?)\s*-->/;

/** コードブロックの開きと閉じの行 */
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;

/** マーカーの引数から取り込み先のパスを取り出す。JSON のオブジェクトは `path`、今の書き方は引数の文字のまま */
const targetOf = (written: string): string | undefined => {
  if (!written.startsWith("{")) {
    return written;
  }
  try {
    const value: unknown = JSON.parse(written);
    const path =
      typeof value === "object" && value !== null
        ? (value as { path?: unknown }).path
        : undefined;
    return typeof path === "string" ? path : undefined;
  } catch {
    // 読めない引数は、描くときに記載の警告になり取り込まない
    return undefined;
  }
};

/** フェンスの行の後の、開いているコードブロックのフェンス（閉じたら `undefined`） */
const fenceAfter = (
  fence: string | undefined,
  opening: string,
): string | undefined => {
  if (fence === undefined) {
    return opening;
  }
  return opening[0] === fence[0] && opening.length >= fence.length
    ? undefined
    : fence;
};

/** 本文の include のマーカー（コードブロックの中を除く）に記載した取り込み先を返却する */
const findMarkers = (markdown: string): string[] => {
  const found: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const opening = FENCE_PATTERN.exec(line)?.[1];
    if (opening !== undefined) {
      fence = fenceAfter(fence, opening);
      continue;
    }
    const written =
      fence === undefined ? MARKER_PATTERN.exec(line)?.[1] : undefined;
    const target = written === undefined ? undefined : targetOf(written);
    if (target) {
      found.push(target);
    }
  }
  return found;
};

/** `inner` が `root` の中のパスか */
const isInside = (root: string, inner: string): boolean => {
  const path = relative(root, inner);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
};

/** 開いている Markdown の include のマーカーを解き、根のフォルダの中の読み込めるファイルだけを `readFile` で読み込んで、取り込む文書の表と読み込んだファイルのパスを返却する。取り込んだ Markdown の中のマーカーもたどり、同じファイルは 1 回だけ読み込む */
export const readIncludes = async (options: {
  /** 開いている Markdown の絶対パス */
  markdownPath: string;
  /** 開いている Markdown の本文 */
  markdown: string;
  /** 根のフォルダの絶対パス */
  root: string;
  /** ファイルを読み込む関数（読み込めないとき `undefined`） */
  readFile: (path: string) => Promise<string | undefined>;
}): Promise<{ includes: Record<string, string>; paths: string[] }> => {
  const { markdownPath, markdown, root, readFile } = options;
  const baseDir = dirname(markdownPath);
  const includes: Record<string, string> = {};
  const paths: string[] = [];
  const visited = new Set<string>();
  const visit = async (text: string, from: string): Promise<void> => {
    for (const written of findMarkers(text)) {
      const key = includeKey(from, written);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const file = resolve(baseDir, key);
      if (!isInside(root, file)) {
        continue;
      }
      const content = await readFile(file);
      if (content === undefined) {
        continue;
      }
      includes[key] = content;
      paths.push(file);
      if (/\.(?:md|markdown)$/i.test(key)) {
        await visit(content, key);
      }
    }
  };
  await visit(markdown, "");
  return { includes, paths };
};
