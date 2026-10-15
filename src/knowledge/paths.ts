/** スキームを持つ URL（`https:`・`mailto:` など）を見分ける正規表現 */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/** `.` と空の要素を除き、`/` で区切ったパスにそろえる（`./a//b.md` → `a/b.md`） */
export function normalizePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
    .join("/");
}

/** パスのフォルダの要素（ファイル名を除く） */
function directoryOf(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean).slice(0, -1);
}

/** 文書の `path` を基準に、本文のリンクの `href` を索引のファイルからのパスにする。参照にしないリンクは `undefined` */
export function resolveLink(
  fromPath: string,
  href: string,
): string | undefined {
  if (href.startsWith("/") || SCHEME_PATTERN.test(href)) {
    return undefined;
  }
  const target = href.split(/[?#]/)[0] ?? "";
  if (target === "") {
    return undefined;
  }
  let decoded = target;
  try {
    decoded = decodeURI(target);
  } catch {
    // 戻せないときは、そのまま比べる
  }
  const segments = directoryOf(fromPath);
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      // 索引のフォルダの外へ出るリンクは参照にしない
      if (segments.pop() === undefined) {
        return undefined;
      }
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
}

/** 描く文書の `path` から参照先の `path` を指す相対パスを作る。描く文書の `path` が無ければ参照先のまま */
export function relativeHref(
  fromPath: string | undefined,
  toPath: string,
): string {
  if (fromPath === undefined) {
    return toPath;
  }
  const from = directoryOf(fromPath);
  const to = normalizePath(toPath).split("/");
  let common = 0;
  while (
    common < from.length &&
    common < to.length - 1 &&
    from[common] === to[common]
  ) {
    common += 1;
  }
  const ups = Array.from({ length: from.length - common }, () => "..");
  return [...ups, ...to.slice(common)].join("/");
}
