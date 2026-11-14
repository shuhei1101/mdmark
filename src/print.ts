import { setCodeFoldOpen } from "./interact/code-folds.ts";
import { setErTableFolded } from "./interact/er-folds.ts";
import { setFolderOpen } from "./interact/trees.ts";

/** 印刷の前に開いた折り畳み・セクション・行の詳細・ファイルツリーのフォルダ・コードブロックの畳んだ行・ER 図の畳んだテーブル・タブの中身 */
type Expanded = {
  details: HTMLDetailsElement[];
  sections: HTMLElement[];
  rows: HTMLElement[];
  panels: HTMLElement[];
  tabs: HTMLElement[];
  folders: Element[];
  codeFolds: Element[];
  erTables: HTMLElement[];
};

/** 何も開いていない状態 */
function nothingExpanded(): Expanded {
  return {
    details: [],
    sections: [],
    rows: [],
    panels: [],
    tabs: [],
    folders: [],
    codeFolds: [],
    erTables: [],
  };
}

/** 要素の中の、閉じた折り畳み・閉じたセクション・行の詳細・タブの中身・ファイルツリーの閉じたフォルダ・コードブロックの畳んだ行・ER 図の畳んだテーブル */
function collectClosed(root: HTMLElement): Expanded {
  return {
    details: [...root.querySelectorAll("details")].filter(
      (details) => !details.open,
    ),
    sections: [
      ...root.querySelectorAll<HTMLElement>(".mdmark-section-body[hidden]"),
    ],
    rows: [...root.querySelectorAll<HTMLElement>(".mdmark-row-detail[hidden]")],
    panels: [
      ...root.querySelectorAll<HTMLElement>('[role="tabpanel"][hidden]'),
    ],
    tabs: [...root.querySelectorAll<HTMLElement>(".mdmark-tabs")],
    folders: [
      ...root.querySelectorAll(
        'div.mdmark-tree .mdmark-tree-toggle[aria-expanded="false"]',
      ),
    ],
    codeFolds: [
      ...root.querySelectorAll('.mdmark-code-fold[aria-expanded="false"]'),
    ],
    erTables: [
      ...root.querySelectorAll<HTMLElement>(
        '.mdmark-diagram-er-fold[aria-expanded="false"]',
      ),
    ]
      .map((button) => button.closest<HTMLElement>(".mdmark-diagram-er-table"))
      .filter((table): table is HTMLElement => table !== null),
  };
}

/** ファイルツリーのフォルダ・コードブロックの畳んだ行・ER 図のテーブルを開く・畳む */
function setFoldsOpen(expanded: Expanded, open: boolean): void {
  for (const folder of expanded.folders) {
    setFolderOpen(folder, open);
  }
  for (const toggle of expanded.codeFolds) {
    setCodeFoldOpen(toggle, open);
  }
  for (const table of expanded.erTables) {
    setErTableFolded({ table, folded: !open });
  }
}

/** 印刷の前に閉じていたものを全て開く。印刷の CSS がタブの並びを隠し、タブ名をタイトルにして中身を縦に並べる */
function openClosed(expanded: Expanded): void {
  setFoldsOpen(expanded, true);
  for (const details of expanded.details) {
    details.open = true;
  }
  for (const element of [
    ...expanded.sections,
    ...expanded.rows,
    ...expanded.panels,
  ]) {
    element.removeAttribute("hidden");
  }
  for (const tabs of expanded.tabs) {
    tabs.setAttribute("data-printing", "");
  }
}

/** 印刷の前に開いたものだけを閉じ直す */
function closeExpanded(expanded: Expanded): void {
  for (const details of expanded.details) {
    details.open = false;
  }
  for (const section of expanded.sections) {
    section.setAttribute("hidden", "until-found");
  }
  for (const element of [...expanded.rows, ...expanded.panels]) {
    element.setAttribute("hidden", "");
  }
  for (const tabs of expanded.tabs) {
    tabs.removeAttribute("data-printing");
  }
  setFoldsOpen(expanded, false);
}

/** 畳んだ階層の表の行と、隠した YAML の見本を出す・隠す */
function setTreeHidden(
  hidden: boolean,
  targets: { treeRows: HTMLElement[]; examples: HTMLElement[] },
): void {
  for (const row of targets.treeRows) {
    row.hidden = hidden;
  }
  for (const layout of targets.examples) {
    layout.classList.toggle("is-example-hidden", hidden);
    const aside = layout.querySelector<HTMLElement>(".mdmark-tree-example");
    if (aside) {
      aside.hidden = hidden;
    }
  }
}

/** 印刷の前に、要素の中の閉じた折り畳み・閉じたセクション・行の詳細・ファイルツリーの閉じたフォルダ・コードブロックの畳んだ行・ER 図の畳んだテーブルを開き、タブの全ての中身を出し、印刷の後に開いたものだけを戻す受け取りを `window` に付け、削除する関数を返却する */
export function attachPrint(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 印刷の機能がオンか（印刷のたびに読み込む） */
  isEnabled: () => boolean;
}): () => void {
  const { root, isEnabled } = options;
  let expanded = nothingExpanded();
  // 畳んだ階層の表の行と、隠した YAML の見本
  let treeRows: HTMLElement[] = [];
  let examples: HTMLElement[] = [];
  /** 印刷の前: 閉じたものを全て開き、開いた分を記録する */
  const onBeforePrint = (): void => {
    if (!isEnabled()) {
      return;
    }
    expanded = collectClosed(root);
    treeRows = [
      ...root.querySelectorAll<HTMLElement>(
        "tr.mdmark-tree-row[data-tree-folded]",
      ),
    ];
    examples = [
      ...root.querySelectorAll<HTMLElement>(
        ".mdmark-tree-layout.is-example-hidden",
      ),
    ];
    openClosed(expanded);
    setTreeHidden(false, { treeRows, examples });
  };
  /** 印刷の後: 印刷の前に開いたものだけを戻す */
  const onAfterPrint = (): void => {
    closeExpanded(expanded);
    setTreeHidden(true, { treeRows, examples });
    treeRows = [];
    examples = [];
    expanded = nothingExpanded();
  };
  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  return () => {
    window.removeEventListener("beforeprint", onBeforePrint);
    window.removeEventListener("afterprint", onAfterPrint);
  };
}
