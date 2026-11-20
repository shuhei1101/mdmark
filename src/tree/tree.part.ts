import { renderCodeBar } from "../code-block/code-block.part.ts";
import { escapeHtml } from "../shared/escape.logic.ts";
import { iconSvg } from "../shared/icons.part.ts";
import { renderCopyPanel } from "../table/table.part.ts";

/** 罫線を読み込んだ 1 項目 */
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

/** 拡張子から種類を参照する表 */
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

/** ファイル名から、アイコンの種類を返却する。名前そのものを先に引き、次に最後の `.` の後ろを小文字にした拡張子で参照する。どれにも該当しなければ `file` */
export function fileIconOf(name: string): FileIcon {
  const byName = ICON_BY_NAME[name];
  if (byName) {
    return byName;
  }
  const dot = name.lastIndexOf(".");
  const extension = dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  return ICON_BY_EXTENSION.get(extension) ?? "file";
}

/** ルートを 0 としたフォルダの深さと `data-open` の値から、既定で開くかを返却する。`all` と値が無いときは常に開き、数は深さがその数より浅いときに開く */
export function folderOpenByDefault(
  depth: number,
  open: string | undefined,
): boolean {
  if (open === undefined || open === "all") {
    return true;
  }
  return depth < Number(open);
}

/** コピーのボタンの中身（アイコンと文言）の HTML を返却する */
export function renderTreeCopyContent(state: TreeCopyState): string {
  const label = COPY_LABELS[state];
  return `${iconSvg(label.icon)}${label.text}`;
}

/** ツリーの上に配置する帯（記載した言語のラベル・コピーのボタン・スクリーンリーダーの通知）の HTML を返却する。中身は部品『コードブロック』の帯と共通 */
export function renderTreeBar(options: {
  language: string;
  copyState?: TreeCopyState;
}): string {
  return `<div class="mdmark-code-bar">${renderCodeBar({
    language: options.language,
    fileName: "",
    title: "",
    copyState: options.copyState ?? "idle",
    raw: undefined,
  })}</div>`;
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
  position: { depth: number; path: string },
): string {
  const { depth, path } = position;
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
      renderNode(child, context, {
        depth: depth + 1,
        path: `${path}-${index}`,
      }),
    )
    .join("");
  if (!context.interactive) {
    return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row">${name}${note}</span><ul>${nested}</ul></li>`;
  }
  const listId = `${context.id}-${path}`;
  const open = folderOpenByDefault(depth, context.open);
  return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row"><button class="mdmark-tree-toggle" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(listId)}">${name}</button>${note}</span><ul id="${escapeHtml(listId)}"${open ? "" : ' hidden="until-found"'}>${nested}</ul></li>`;
}

/** ファイルツリーの HTML を返却する。`render` は全てのフォルダを開いて出し、`interactive` のときは `mount` が付けた後の帯と開閉のボタンも描く */
export function renderTree(options: {
  /** 項目 */
  nodes: TreeNode[];
  /** コードブロックに記載した罫線のテキスト（コピーするテキスト） */
  source: string;
  /** 既定で開く階層（`open=` の値。`all` か 1 以上の整数の文字） */
  open?: string | undefined;
  /** `mount` が付けた状態にするか（既定 `false`） */
  interactive?: boolean;
  /** 長い項目を折り返すか（既定 `false`） */
  wrap?: boolean | undefined;
  /** コピーのボタンの状態（既定 `idle`） */
  copyState?: TreeCopyState;
  /** クリップボードに書き込めなかったときのパネルを出すか（既定 `false`） */
  copyFallback?: boolean;
  /** `aria-controls` の id の頭（既定 `mdmark-tree`） */
  id?: string;
  /** 帯のラベルにする記載した言語（既定 `tree`。空ならラベルを出さない） */
  language?: string;
}): string {
  const {
    nodes,
    source,
    open,
    interactive = false,
    copyState,
    copyFallback = false,
    id = "mdmark-tree",
    language = "tree",
  } = options;
  const context: RenderContext = { interactive, open, id };
  const openAttribute =
    open === undefined ? "" : ` data-open="${escapeHtml(open)}"`;
  const list = `<ul class="mdmark-tree-list" aria-label="ファイルツリー">${nodes
    .map((node, index) =>
      renderNode(node, context, { depth: 0, path: String(index) }),
    )
    .join("")}</ul>`;
  const { bar, panel } = treeControls({
    interactive,
    language,
    copyState,
    copyFallback,
    id,
    source,
  });
  const holderClass = options.wrap
    ? "mdmark-tree mdmark-tree-wrap"
    : "mdmark-tree";
  return `<div class="${holderClass}"${openAttribute}${treeLanguageAttribute(language)} data-source="${escapeHtml(source)}">${bar}${list}${panel}</div>`;
}

/** `mount` が付けた状態の帯と、クリップボードに書き込めなかったときのパネル（`interactive` でなければ空） */
function treeControls(options: {
  interactive: boolean;
  language: string;
  copyState: TreeCopyState | undefined;
  copyFallback: boolean;
  id: string;
  source: string;
}): { bar: string; panel: string } {
  const { interactive, language, copyState, copyFallback, id, source } =
    options;
  if (!interactive) return { bar: "", panel: "" };
  return {
    bar: renderTreeBar({ language, copyState: copyState ?? "idle" }),
    panel: copyFallback
      ? renderCopyPanel({ id: `${id}-panel`, format: "tree", text: source })
      : "",
  };
}

/** 言語が tree でないファイルツリーの記載した言語の属性（空の言語は空の値） */
function treeLanguageAttribute(language: string): string {
  return language === "tree"
    ? ""
    : ` data-tree-language="${escapeHtml(language)}"`;
}
