import { renderCopyPanel } from "../parts/table.ts";
import {
  folderOpenByDefault,
  renderTreeBar,
  renderTreeCopyContent,
  type TreeCopyState,
} from "../parts/tree.ts";
import { COPIED_NOTICE_MS, copyText } from "./clipboard.ts";

// 開閉の対象の `ul` の id と、コピーのパネルの id を文書の中で重ならせないための通し番号
let treeCounter = 0;

/** 注釈の左端の手前に空ける幅（名前の後ろの点線の最小の幅と、その前後の余白。単位は文字の高さ） */
const NOTE_GAP_EM = 2;

/** コピーできたことの読み上げ */
const COPIED_ANNOUNCEMENT = "ツリーのテキストをコピーしました";

/** コピーできなかったことの読み上げ */
const COPY_FAILED_ANNOUNCEMENT =
  "クリップボードにコピーできませんでした。選択したツリーのテキストを手でコピーできます";

/** 注釈の列を測る canvas の文脈 */
const measureContext =
  typeof document === "undefined"
    ? undefined
    : document.createElement("canvas").getContext("2d");

/** 開閉のボタンが開閉する入れ子の `ul` を返す */
function controlledList(toggle: Element): HTMLElement | null {
  return (
    toggle.closest("li")?.querySelector<HTMLElement>(":scope > ul") ?? null
  );
}

/** フォルダを開く・閉じる。閉じた入れ子の `ul` は `hidden="until-found"` にして、ページ内検索が中を見つけられるようにする */
export function setFolderOpen(toggle: Element, open: boolean): void {
  toggle.setAttribute("aria-expanded", String(open));
  const list = controlledList(toggle);
  if (open) {
    list?.removeAttribute("hidden");
  } else {
    list?.setAttribute("hidden", "until-found");
  }
}

/** 押したフォルダを開閉する。`deep` が真なら、入れ子のフォルダも同じ向きにする */
function toggleFolder(toggle: Element, deep: boolean): void {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  setFolderOpen(toggle, open);
  if (!deep) {
    return;
  }
  for (const inner of controlledList(toggle)?.querySelectorAll(
    ".mdmark-tree-toggle",
  ) ?? []) {
    setFolderOpen(inner, open);
  }
}

/** リストの中の要素の、ルートを 0 とした深さ（入れ子の `ul` の数）を返す */
function depthOf(element: Element, list: Element): number {
  let depth = 0;
  for (
    let parent = element.parentElement;
    parent && parent !== list;
    parent = parent.parentElement
  ) {
    if (parent.tagName === "UL") {
      depth += 1;
    }
  }
  return depth;
}

/** 注釈の左端を、注釈を持つ全ての行で同じ位置にそろえる値（`--mdmark-tree-note-start`・`--mdmark-tree-indent` と各行の `--mdmark-tree-depth`）を `tree` に入れ、取り除く関数を返す */
function alignNotes(tree: HTMLElement, list: HTMLElement): () => void {
  const rows = [...list.querySelectorAll<HTMLElement>(".mdmark-tree-row")];
  const noted = rows.filter((row) =>
    row.querySelector(":scope > .mdmark-tree-note"),
  );
  const reset = (): void => {
    tree.style.removeProperty("--mdmark-tree-note-start");
    tree.style.removeProperty("--mdmark-tree-indent");
    for (const row of rows) {
      row.style.removeProperty("--mdmark-tree-depth");
    }
  };
  if (noted.length === 0 || !measureContext) {
    return reset;
  }
  const style = getComputedStyle(list);
  measureContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const em = Number.parseFloat(style.fontSize);
  const nested = list.querySelector("ul");
  const nestedStyle = nested && getComputedStyle(nested);
  const indent = nestedStyle
    ? Number.parseFloat(nestedStyle.marginInlineStart) +
      Number.parseFloat(nestedStyle.borderInlineStartWidth) +
      Number.parseFloat(nestedStyle.paddingInlineStart)
    : 0;
  /** 行の名前の文字の幅（「ほかにもある」は読み上げの文だけなので 0） */
  const textWidth = (row: HTMLElement): number =>
    row.closest(".mdmark-tree-more")
      ? 0
      : measureContext.measureText(
          row.querySelector(".mdmark-tree-name")?.textContent?.trim() ?? "",
        ).width;
  // 注釈の列の最小の幅を外してから、見えている行の名前の塊の幅（山形・アイコンを含む）から文字の幅を引いて、名前の塊の種類ごとに文字の前の幅を求める
  tree.style.removeProperty("--mdmark-tree-note-start");
  const leads = new Map<string, number>();
  for (const row of rows) {
    const head = row.firstElementChild;
    if (head instanceof HTMLElement && head.offsetParent) {
      const kind = head.classList.contains("mdmark-tree-toggle")
        ? "toggle"
        : "plain";
      if (!leads.has(kind)) {
        const noted = row.querySelector(":scope > .mdmark-tree-note");
        leads.set(
          kind,
          head.getBoundingClientRect().width -
            textWidth(row) -
            (noted ? NOTE_GAP_EM * em : 0),
        );
      }
    }
  }
  /** 行の名前の塊の、文字の前の幅 */
  const leadOf = (row: HTMLElement): number =>
    leads.get(
      row.firstElementChild?.classList.contains("mdmark-tree-toggle")
        ? "toggle"
        : "plain",
    ) ??
    [...leads.values()][0] ??
    0;
  tree.style.setProperty("--mdmark-tree-indent", `${indent}px`);
  let widest = 0;
  for (const row of noted) {
    const depth = depthOf(row, list);
    row.style.setProperty("--mdmark-tree-depth", String(depth));
    widest = Math.max(
      widest,
      depth * indent + leadOf(row) + textWidth(row) + NOTE_GAP_EM * em,
    );
  }
  tree.style.setProperty("--mdmark-tree-note-start", `${Math.ceil(widest)}px`);
  return reset;
}

/** `render` が出したファイルツリーの注釈の列の位置を測って入れる（Storybook が帯と開閉のボタンを描いたツリーに使う） */
export function alignFileTreeNotes(tree: HTMLElement): void {
  const list = tree.querySelector<HTMLElement>(":scope > .mdmark-tree-list");
  if (list) {
    alignNotes(tree, list);
  }
}

/** ファイルツリー 1 つに、帯・開閉のボタン・コピーを付け、取り除く関数を返す */
function attachTree(tree: HTMLElement): () => void {
  const list = tree.querySelector<HTMLElement>(":scope > .mdmark-tree-list");
  if (!list) {
    return () => {};
  }
  const source = tree.dataset.source ?? "";
  const prefix = `mdmark-tree-${treeCounter++}`;
  const cleanups: Array<() => void> = [];
  let detached = false;

  // 帯: 種類とコピーのボタン
  list.insertAdjacentHTML("beforebegin", renderTreeBar({}));
  const bar = tree.querySelector<HTMLElement>(":scope > .mdmark-tree-bar");
  const copyButton = bar?.querySelector<HTMLButtonElement>(".mdmark-tree-copy");
  const status = bar?.querySelector<HTMLElement>(".mdmark-tree-status");
  cleanups.push(() => bar?.remove());

  // フォルダの名前を開閉のボタンで包み、開く階層より深いフォルダを閉じる
  list
    .querySelectorAll<HTMLElement>("li.mdmark-tree-folder")
    .forEach((folder, index) => {
      const nested = folder.querySelector<HTMLElement>(":scope > ul");
      const name = folder.querySelector<HTMLElement>(
        ":scope > .mdmark-tree-row > .mdmark-tree-name",
      );
      const row = name?.parentElement;
      if (!nested || !name || !row) {
        return;
      }
      const button = document.createElement("button");
      button.className = "mdmark-tree-toggle";
      button.type = "button";
      nested.id = `${prefix}-${index}`;
      button.setAttribute("aria-controls", nested.id);
      row.insertBefore(button, name);
      button.append(name);
      setFolderOpen(
        button,
        folderOpenByDefault(depthOf(folder, list), tree.dataset.open),
      );
      cleanups.push(() => {
        row.insertBefore(name, button);
        button.remove();
        nested.removeAttribute("hidden");
        nested.removeAttribute("id");
      });
    });

  // 開閉: 押す・Enter・Space。Shift を押しながらなら入れ子も同じ向きにする
  const onClick = (event: MouseEvent): void => {
    const toggle =
      event.target instanceof Element
        ? event.target.closest(".mdmark-tree-toggle")
        : null;
    if (toggle && list.contains(toggle)) {
      toggleFolder(toggle, event.shiftKey);
    }
  };
  list.addEventListener("click", onClick);
  cleanups.push(() => list.removeEventListener("click", onClick));

  // ページ内検索が閉じたフォルダの中に当たったとき、そのフォルダと外のフォルダを開いた状態にする
  const onBeforeMatch = (event: Event): void => {
    for (
      let element = event.target instanceof Element ? event.target : null;
      element && element !== list;
      element = element.parentElement
    ) {
      const toggle =
        element.tagName === "UL"
          ? element
              .closest("li")
              ?.querySelector(":scope > .mdmark-tree-row > .mdmark-tree-toggle")
          : null;
      if (toggle) {
        setFolderOpen(toggle, true);
      }
    }
  };
  list.addEventListener("beforematch", onBeforeMatch);
  cleanups.push(() => list.removeEventListener("beforematch", onBeforeMatch));

  // コピー: 元の罫線のテキストを書き、書けなければ手でコピーさせるパネルを出す
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const setCopyState = (state: TreeCopyState): void => {
    if (copyButton) {
      copyButton.dataset.state = state;
      copyButton.innerHTML = renderTreeCopyContent(state);
    }
  };
  const announce = (message: string): void => {
    if (status) {
      status.textContent = message;
    }
  };
  /** 手でコピーさせるパネルを取り除く。`returnFocus` が真なら、コピーのボタンへフォーカスを戻す */
  const closePanel = (returnFocus: boolean): void => {
    tree.querySelector(":scope > .mdmark-copy-panel")?.remove();
    if (returnFocus) {
      copyButton?.focus();
    }
  };
  const copyTree = async (): Promise<void> => {
    clearTimeout(copyTimer);
    closePanel(false);
    const copied = await copyText(source);
    if (detached) {
      return;
    }
    if (copied) {
      setCopyState("copied");
      announce(COPIED_ANNOUNCEMENT);
      copyTimer = setTimeout(() => {
        setCopyState("idle");
        announce("");
      }, COPIED_NOTICE_MS);
      return;
    }
    setCopyState("idle");
    tree.insertAdjacentHTML(
      "beforeend",
      renderCopyPanel({ id: `${prefix}-panel`, format: "tree", text: source }),
    );
    const textarea = tree.querySelector<HTMLTextAreaElement>(
      ".mdmark-copy-panel-text",
    );
    textarea?.focus();
    textarea?.select();
    announce(COPY_FAILED_ANNOUNCEMENT);
  };
  const onTreeClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".mdmark-tree-copy")) {
      void copyTree();
    } else if (target?.closest(".mdmark-copy-panel-close")) {
      closePanel(true);
    }
  };
  const onTreeKeydown = (event: KeyboardEvent): void => {
    if (
      event.key === "Escape" &&
      event.target instanceof Element &&
      event.target.closest(".mdmark-copy-panel")
    ) {
      closePanel(true);
    }
  };
  tree.addEventListener("click", onTreeClick);
  tree.addEventListener("keydown", onTreeKeydown);
  cleanups.push(() => {
    tree.removeEventListener("click", onTreeClick);
    tree.removeEventListener("keydown", onTreeKeydown);
    clearTimeout(copyTimer);
    closePanel(false);
  });

  // 注釈の列: 書体を読み終えてからも測り直す
  let resetNotes = alignNotes(tree, list);
  void document.fonts?.ready.then(() => {
    if (!detached) {
      resetNotes();
      resetNotes = alignNotes(tree, list);
    }
  });
  cleanups.push(() => resetNotes());

  return () => {
    detached = true;
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}

/** 描いた要素の中のファイルツリーに、帯とコピーのボタン・フォルダの開閉・注釈の列の位置を付け、まとめて外して `render` の出した状態に戻す関数を返す */
export function attachFileTrees(root: HTMLElement): () => void {
  const detachers = [
    ...root.querySelectorAll<HTMLElement>("div.mdmark-tree"),
  ].map(attachTree);
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
