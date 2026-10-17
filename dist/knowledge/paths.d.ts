/** `.` と空の要素を除き、`/` で区切ったパスにそろえる（`./a//b.md` → `a/b.md`） */
export declare function normalizePath(path: string): string;
/** 文書の `path` を基準に、本文のリンクの `href` を索引のファイルからのパスにする。参照にしないリンクは `undefined` */
export declare function resolveLink(fromPath: string, href: string): string | undefined;
/** 描く文書の `path` から参照先の `path` を指す相対パスを作る。描く文書の `path` が無ければ参照先のまま */
export declare function relativeHref(fromPath: string | undefined, toPath: string): string;
