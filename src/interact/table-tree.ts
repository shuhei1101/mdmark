import type { TooltipPlacement } from "../config.ts";
import { renderTreeTools } from "../parts/table.ts";
import { filterTreeRows, type TreeRowPlan } from "../tree-logic.ts";
import { COPIED_NOTICE_MS, copyText } from "./clipboard.ts";

/** 開閉で隠した行に付ける属性（印刷の前後で開閉を戻すのに使う） */
export const TREE_FOLDED_ATTRIBUTE = "data-tree-folded";

/** 階層の表の操作の取っ手。`attachTable` が絞り込みのたびに `refresh` を呼ぶ */
export type TableTreeHandle = {
  /** キーの列の絞り込みの単語と、ほかの絞り込みに合う行かを受け、行の表示と当たった単語の印を決め直す。表示した補った行でない行の数を返す */
  refresh: (options: {
    word: string;
    matches: (row: HTMLTableRowElement) => boolean;
  }) => number;
  /** 受け取りとボタンを外す */
  detach: () => void;
};

/** 行の計画を DOM の行から作る */
function planOf(row: HTMLTableRowElement): TreeRowPlan {
  const path = row.dataset.path ?? "";
  return {
    path,
    parent: row.dataset.parent ?? "",
    depth: Number(row.dataset.depth ?? 0),
    name: row.querySelector(".mdmark-tree-name")?.textContent ?? "",
    virtual: row.classList.contains("is-virtual"),
    hasChildren: row.classList.contains("has-children"),
    source: undefined,
  };
}

/** 末尾の名前に配列の `[]` を付けた名前（絞り込みの照合に使う） */
function nameOf(row: HTMLTableRowElement): string {
  const name = row.querySelector(".mdmark-tree-name")?.textContent ?? "";
  return row.querySelector(".mdmark-tree-array") ? `${name}[]` : name;
}

/** `data-tree` の表の子を持つ行に開閉のボタン、各行にパスのコピーのボタンと全体のパスのツールチップを置き、開閉・行の選択・見本との連動と見本の表示の切り替えを付ける */
export function attachTableTree(options: {
  /** `div.mdmark-table[data-tree]` */
  wrapper: HTMLElement;
  /** ツールチップを出す場所 */
  placement: TooltipPlacement;
}): TableTreeHandle {
  const { wrapper } = options;
  const rows = [
    ...wrapper.querySelectorAll<HTMLTableRowElement>(
      ":scope table > tbody > tr.mdmark-tree-row",
    ),
  ];
  const cleanups: Array<() => void> = [];
  const descendantsOf = (path: string): HTMLTableRowElement[] =>
    rows.filter((row) => (row.dataset.path ?? "").startsWith(`${path}.`));
  const toggleOf = (row: HTMLTableRowElement): HTMLButtonElement | null =>
    row.querySelector<HTMLButtonElement>("button.mdmark-tree-toggle");

  // ─── ボタンとツールチップ ───
  for (const row of rows) {
    const cell = row.querySelector<HTMLElement>(".mdmark-tree-cell");
    const name = cell?.querySelector<HTMLElement>(".mdmark-tree-name");
    if (!cell || !name) {
      continue;
    }
    const path = row.dataset.path ?? "";
    const added: Element[] = [];
    const guides = cell.querySelectorAll(".mdmark-tree-guide");
    const anchor = guides[guides.length - 1] ?? null;
    if (row.classList.contains("has-children")) {
      const template = document.createElement("template");
      template.innerHTML = renderTreeTools({
        kind: "toggle",
        path,
        expanded: true,
      });
      const toggle = template.content.firstElementChild;
      if (toggle) {
        if (anchor) {
          anchor.after(toggle);
        } else {
          cell.prepend(toggle);
        }
        added.push(toggle);
      }
    } else {
      const spacer = document.createElement("span");
      spacer.className = "mdmark-tree-spacer";
      spacer.setAttribute("aria-hidden", "true");
      if (anchor) {
        anchor.after(spacer);
      } else {
        cell.prepend(spacer);
      }
      added.push(spacer);
    }
    const tip = document.createElement("span");
    tip.className = "mdmark-tree-tip";
    tip.setAttribute("role", "tooltip");
    tip.id = `${wrapper.id || "mdmark-tree"}-tip-${rows.indexOf(row)}`;
    tip.textContent = path;
    tip.hidden = true;
    name.setAttribute("aria-describedby", tip.id);
    const copyTemplate = document.createElement("template");
    copyTemplate.innerHTML = renderTreeTools({ kind: "copy" });
    const copy = copyTemplate.content.firstElementChild;
    cell.append(tip);
    added.push(tip);
    if (copy) {
      cell.append(copy);
      added.push(copy);
    }
    const show = (): void => {
      tip.hidden = false;
    };
    const hide = (): void => {
      tip.hidden = true;
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        hide();
      }
    };
    name.addEventListener("pointerenter", show);
    name.addEventListener("pointerleave", hide);
    name.addEventListener("focus", show);
    name.addEventListener("blur", hide);
    name.addEventListener("keydown", onKey);
    cleanups.push(() => {
      name.removeEventListener("pointerenter", show);
      name.removeEventListener("pointerleave", hide);
      name.removeEventListener("focus", show);
      name.removeEventListener("blur", hide);
      name.removeEventListener("keydown", onKey);
      name.removeAttribute("aria-describedby");
      for (const element of added) {
        element.remove();
      }
    });
  }

  // ─── 開閉 ───
  /** 祖先のどれかが畳まれているか */
  const collapsed = new Set<string>();
  const hiddenByFold = (row: HTMLTableRowElement): boolean => {
    let parent = row.dataset.parent ?? "";
    while (parent !== "") {
      if (collapsed.has(parent)) {
        return true;
      }
      parent =
        rows.find((r) => r.dataset.path === parent)?.dataset.parent ?? "";
    }
    return false;
  };
  let word = "";
  let matches: (row: HTMLTableRowElement) => boolean = () => true;
  let foldedBeforeFilter: Set<string> | undefined;
  /** 行の表示と当たった単語の印を決め直し、表示した補った行でない行の数を返す */
  const refresh: TableTreeHandle["refresh"] = (next) => {
    const nextWord = next.word.trim();
    if (nextWord !== "" && word === "") {
      foldedBeforeFilter = new Set(collapsed);
    }
    if (nextWord === "" && word !== "" && foldedBeforeFilter) {
      // 絞り込みを解くと、絞り込む前の開閉の状態に戻す
      collapsed.clear();
      for (const path of foldedBeforeFilter) {
        collapsed.add(path);
      }
      foldedBeforeFilter = undefined;
    }
    word = nextWord;
    matches = next.matches;
    const result = filterTreeRows({
      rows: rows.map((row) => ({ ...planOf(row), name: nameOf(row) })),
      word,
    });
    let shown = 0;
    for (const row of rows) {
      const path = row.dataset.path ?? "";
      const name = row.querySelector<HTMLElement>(".mdmark-tree-name");
      if (name) {
        name.textContent = name.textContent ?? "";
      }
      const folded = word === "" && hiddenByFold(row);
      const visible =
        matches(row) && (word === "" ? !folded : result.keep.has(path));
      row.hidden = !visible;
      row.toggleAttribute(TREE_FOLDED_ATTRIBUTE, folded && matches(row));
      if (name && word !== "" && result.hits.has(path)) {
        const text = name.textContent ?? "";
        const at = text.toLowerCase().indexOf(word.toLowerCase());
        if (at >= 0) {
          name.innerHTML = "";
          const mark = document.createElement("mark");
          mark.className = "mdmark-tree-hit";
          mark.textContent = text.slice(at, at + word.length);
          name.append(text.slice(0, at), mark, text.slice(at + word.length));
        }
      }
      if (visible && !row.classList.contains("is-virtual")) {
        shown += 1;
      }
    }
    for (const row of rows) {
      const toggle = toggleOf(row);
      if (toggle) {
        const expanded = !collapsed.has(row.dataset.path ?? "");
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.setAttribute(
          "aria-label",
          `${row.dataset.path ?? ""} を${expanded ? "畳む" : "開く"}`,
        );
      }
    }
    return shown;
  };
  /** 行の子孫を畳む・開く。`deep` なら入れ子の行も同じにする */
  const setFolded = (
    row: HTMLTableRowElement,
    fold: boolean,
    deep: boolean,
  ): void => {
    const path = row.dataset.path ?? "";
    if (fold) {
      collapsed.add(path);
    } else {
      collapsed.delete(path);
    }
    if (deep) {
      for (const descendant of descendantsOf(path)) {
        if (descendant.classList.contains("has-children")) {
          if (fold) {
            collapsed.add(descendant.dataset.path ?? "");
          } else {
            collapsed.delete(descendant.dataset.path ?? "");
          }
        }
      }
    }
    refresh({ word, matches });
  };

  // ─── 行の選択と見本 ───
  const layout = wrapper.closest<HTMLElement>(".mdmark-tree-layout");
  const example = layout?.querySelector<HTMLElement>(
    ":scope > .mdmark-tree-example",
  );
  /** 選んだ行と同じパスの見本の行に印を付ける（無ければどの行にも付けない） */
  const linkExample = (path: string | undefined): void => {
    for (const line of example?.querySelectorAll<HTMLElement>(
      ".mdmark-yaml-line",
    ) ?? []) {
      line.classList.toggle(
        "is-linked",
        path !== undefined && line.dataset.path === path,
      );
    }
  };
  let selected: HTMLTableRowElement | undefined;
  /** 行を選ぶ。同じ行をもう一度選ぶと解く */
  const select = (row: HTMLTableRowElement | undefined): void => {
    const next = row === selected ? undefined : row;
    for (const other of rows) {
      other.setAttribute("aria-selected", String(other === next));
      for (const guide of other.querySelectorAll(".mdmark-tree-guide")) {
        guide.classList.remove("is-active");
      }
    }
    selected = next;
    if (next) {
      const parent = next.dataset.parent ?? "";
      const depth = Number(next.dataset.depth ?? 0);
      const scope = rows.filter((candidate) => {
        const path = candidate.dataset.path ?? "";
        return (
          candidate.dataset.parent === parent ||
          rows.some(
            (sibling) =>
              sibling.dataset.parent === parent &&
              path.startsWith(`${sibling.dataset.path ?? ""}.`),
          )
        );
      });
      for (const candidate of scope) {
        candidate
          .querySelectorAll(".mdmark-tree-guide")
          [depth - 1]?.classList.add("is-active");
      }
    }
    linkExample(next?.dataset.path);
  };
  for (const row of rows) {
    row.setAttribute("aria-selected", "false");
  }
  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const toggle = target.closest<HTMLButtonElement>(
      "button.mdmark-tree-toggle",
    );
    const copy = target.closest<HTMLButtonElement>("button.mdmark-tree-copy");
    const row = target.closest<HTMLTableRowElement>("tr.mdmark-tree-row");
    if (!row || !rows.includes(row)) {
      return;
    }
    if (toggle) {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      setFolded(row, expanded, (event as MouseEvent).shiftKey === true);
      return;
    }
    if (copy) {
      void copyPath(row, copy);
      return;
    }
    if (target.closest("button, a, input")) {
      return;
    }
    select(row);
  };
  /** 全体のパスをクリップボードへ写し、結果を 2 秒出す */
  const copyPath = async (
    row: HTMLTableRowElement,
    button: HTMLButtonElement,
  ): Promise<void> => {
    const status = button.querySelector<HTMLElement>(
      ".mdmark-tree-copy-status",
    );
    const done = await copyText(row.dataset.path ?? "");
    if (status) {
      status.textContent = done ? "コピーしました" : "コピーできませんでした";
      setTimeout(() => {
        status.textContent = "";
      }, COPIED_NOTICE_MS);
    }
  };
  wrapper.addEventListener("click", onClick);
  cleanups.push(() => wrapper.removeEventListener("click", onClick));

  // 見本の行を押すと、表の同じパスの行を選ぶ
  const onExampleClick = (event: Event): void => {
    const line = (event.target as Element | null)?.closest<HTMLElement>(
      ".mdmark-yaml-line[data-path]",
    );
    const row = rows.find(
      (candidate) => candidate.dataset.path === line?.dataset.path,
    );
    if (row && row !== selected) {
      select(row);
    }
  };
  if (example && layout) {
    example.addEventListener("click", onExampleClick);
    const bar = document.createElement("div");
    bar.className = "mdmark-tree-bar";
    bar.innerHTML = renderTreeTools({
      kind: "example",
      expanded: true,
      controls: example.id,
    });
    wrapper.before(bar);
    const button = bar.querySelector<HTMLButtonElement>(
      "button.mdmark-tree-example-toggle",
    );
    const onToggle = (): void => {
      const hidden = !layout.classList.contains("is-example-hidden");
      layout.classList.toggle("is-example-hidden", hidden);
      example.hidden = hidden;
      button?.setAttribute("aria-expanded", String(!hidden));
      if (button) {
        button.textContent = hidden ? "見本を表示" : "見本を隠す";
      }
    };
    button?.addEventListener("click", onToggle);
    cleanups.push(() => {
      example.removeEventListener("click", onExampleClick);
      button?.removeEventListener("click", onToggle);
      bar.remove();
      layout.classList.remove("is-example-hidden");
      example.hidden = false;
    });
  }
  cleanups.push(() => {
    for (const row of rows) {
      row.hidden = false;
      row.removeAttribute("aria-selected");
      row.removeAttribute(TREE_FOLDED_ATTRIBUTE);
    }
  });
  refresh({ word, matches });
  return {
    refresh,
    detach: () => {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    },
  };
}
