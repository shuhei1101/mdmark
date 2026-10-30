import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";
import { renderCopyPanel } from "./table.ts";

/** 罫線を読んだ 1 項目 */
export type TreeNode = {
  /** 項目の名前 */
  name: string;
  /** 注釈の HTML（区切りの `#` の後ろのインラインを描いたもの） */
  note?: string | undefined;
  /** 子の項目 */
  children?: TreeNode[] | undefined;
};

/** ファイルのアイコンの種類（lucide の名前） */
export type FileIcon =
  | "file-text"
  | "file-code"
  | "file-json"
  | "file-image"
  | "file-spreadsheet"
  | "file-archive"
  | "file-terminal"
  | "file";

/** コピーのボタンの状態 */
export type TreeCopyState = "idle" | "copied";

/** 「ほかにもある」を表す項目の名前 */
export const TREE_MORE_NAME = "...";

/** 名前そのもので種類を決めるファイル */
const ICON_BY_NAME: Readonly<Record<string, FileIcon>> = {
  LICENSE: "file-text",
  Dockerfile: "file-terminal",
  Makefile: "file-terminal",
};

/** 種類ごとの拡張子 */
const EXTENSIONS_BY_ICON = {
  "file-text": ["md", "mdx", "txt", "rst"],
  "file-code": [
    "ts",
    "tsx",
    "mts",
    "cts",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "c",
    "h",
    "cpp",
    "cs",
    "php",
    "css",
    "scss",
    "html",
    "vue",
    "svelte",
  ],
  "file-json": [
    "json",
    "jsonc",
    "yaml",
    "yml",
    "toml",
    "xml",
    "ini",
    "env",
    "lock",
  ],
  "file-image": ["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico"],
  "file-spreadsheet": ["csv", "tsv", "xlsx"],
  "file-archive": ["zip", "gz", "tgz", "tar", "vsix"],
  "file-terminal": ["sh", "bash", "zsh", "ps1", "bat"],
} satisfies Record<Exclude<FileIcon, "file">, string[]>;

/** 拡張子から種類を引く表 */
const ICON_BY_EXTENSION = new Map<string, FileIcon>(
  Object.entries(EXTENSIONS_BY_ICON).flatMap(([icon, extensions]) =>
    extensions.map((extension): [string, FileIcon] => [
      extension,
      icon as FileIcon,
    ]),
  ),
);

/** コピーのボタンの状態ごとの文言とアイコン */
const COPY_LABELS = {
  idle: { icon: "copy", text: "コピー" },
  copied: { icon: "check", text: "コピーしました" },
} as const;

/** ファイル名から、アイコンの種類を返す。名前そのものを先に引き、次に最後の `.` の後ろを小文字にした拡張子で引く。どれにも当たらなければ `file` */
export function fileIconOf(name: string): FileIcon {
  const byName = ICON_BY_NAME[name];
  if (byName) {
    return byName;
  }
  const dot = name.lastIndexOf(".");
  const extension = dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  return ICON_BY_EXTENSION.get(extension) ?? "file";
}

/** ルートを 0 としたフォルダの深さと `data-open` の値から、既定で開くかを返す。`all` は常に開き、数は深さがその数より浅いとき、値が無ければルートだけを開く */
export function folderOpenByDefault(
  depth: number,
  open: string | undefined,
): boolean {
  if (open === "all") {
    return true;
  }
  return depth < (open === undefined ? 1 : Number(open));
}

/** コピーのボタンの中身（アイコンと文言）の HTML を返す */
export function renderTreeCopyContent(state: TreeCopyState): string {
  const label = COPY_LABELS[state];
  return `${iconSvg(label.icon)}${label.text}`;
}

/** ツリーの上に置く帯（種類 `tree`・コピーのボタン・読み上げの知らせ）の HTML を返す */
export function renderTreeBar(options: { copyState?: TreeCopyState }): string {
  const state = options.copyState ?? "idle";
  return `<div class="mdmark-tree-bar"><span class="mdmark-tree-kind" aria-hidden="true">tree</span><span class="mdmark-tree-meta"><button class="mdmark-tree-copy" type="button" data-state="${state}">${renderTreeCopyContent(state)}</button><span class="mdmark-visually-hidden mdmark-tree-status" role="status"></span></span></div>`;
}

/** 項目の描き方 */
type RenderContext = {
  /** `mount` が付けた状態にするか */
  interactive: boolean;
  /** `open=` の値 */
  open: string | undefined;
  /** 入れ子の `ul` の id の頭 */
  id: string;
};

/** 項目 1 つを `li` にする。名前が `...` なら「ほかにもある」、`/` で終わるか子を持つ項目はフォルダ、それ以外はファイル */
function renderNode(
  node: TreeNode,
  context: RenderContext,
  depth: number,
  path: string,
): string {
  const note = node.note
    ? `<span class="mdmark-tree-note">${node.note}</span>`
    : "";
  if (node.name === TREE_MORE_NAME) {
    return `<li class="mdmark-tree-more"><span class="mdmark-tree-row"><span class="mdmark-tree-name"><span class="mdmark-visually-hidden">ほかにもあります</span></span>${note}</span></li>`;
  }
  const children = node.children ?? [];
  const name = `<span class="mdmark-tree-name">${escapeHtml(node.name)}</span>`;
  if (!node.name.endsWith("/") && children.length === 0) {
    return `<li class="mdmark-tree-file" data-file-icon="${fileIconOf(node.name)}"><span class="mdmark-tree-row">${name}${note}</span></li>`;
  }
  if (children.length === 0) {
    return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row">${name}${note}</span></li>`;
  }
  const nested = children
    .map((child, index) =>
      renderNode(child, context, depth + 1, `${path}-${index}`),
    )
    .join("");
  if (!context.interactive) {
    return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row">${name}${note}</span><ul>${nested}</ul></li>`;
  }
  const listId = `${context.id}-${path}`;
  const open = folderOpenByDefault(depth, context.open);
  return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row"><button class="mdmark-tree-toggle" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(listId)}">${name}</button>${note}</span><ul id="${escapeHtml(listId)}"${open ? "" : ' hidden="until-found"'}>${nested}</ul></li>`;
}

/** ファイルツリーの HTML を返す。`render` は全てのフォルダを開いて出し、`interactive` のときは `mount` が付けた後の帯と開閉のボタンも描く */
export function renderTree(options: {
  /** 項目 */
  nodes: TreeNode[];
  /** コードブロックに書いた罫線のテキスト（コピーするテキスト） */
  source: string;
  /** 既定で開く階層（`open=` の値。`all` か 1 以上の整数の文字） */
  open?: string | undefined;
  /** `mount` が付けた状態にするか（既定 `false`） */
  interactive?: boolean;
  /** コピーのボタンの状態（既定 `idle`） */
  copyState?: TreeCopyState;
  /** クリップボードに書けなかったときのパネルを出すか（既定 `false`） */
  copyFallback?: boolean;
  /** `aria-controls` の id の頭（既定 `mdmark-tree`） */
  id?: string;
}): string {
  const {
    nodes,
    source,
    open,
    interactive = false,
    copyState,
    copyFallback = false,
    id = "mdmark-tree",
  } = options;
  const context: RenderContext = { interactive, open, id };
  const openAttribute =
    open === undefined ? "" : ` data-open="${escapeHtml(open)}"`;
  const bar = interactive
    ? renderTreeBar({ copyState: copyState ?? "idle" })
    : "";
  const list = `<ul class="mdmark-tree-list" aria-label="ファイルツリー">${nodes
    .map((node, index) => renderNode(node, context, 0, String(index)))
    .join("")}</ul>`;
  const panel =
    interactive && copyFallback
      ? renderCopyPanel({ id: `${id}-panel`, format: "tree", text: source })
      : "";
  return `<div class="mdmark-tree"${openAttribute} data-source="${escapeHtml(source)}">${bar}${list}${panel}</div>`;
}
