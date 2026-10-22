import { rowIdFromHash } from "../table-logic.ts";
import { visibleText } from "./text.ts";

/** 節の開閉を切り替える関数。節の中身の要素から引く */
type SetOpen = (open: boolean) => void;

/** 節の見出し 1 つを開閉のボタンにし、閉じた節の中身を隠す。外す関数を返す */
function attachSection(
  heading: HTMLElement,
  body: HTMLElement,
  setters: Map<HTMLElement, SetOpen>,
): () => void {
  const anchor = heading.querySelector(":scope > .mdmark-anchor");
  const button = document.createElement("button");
  button.className = "mdmark-section-toggle";
  button.type = "button";
  button.setAttribute("aria-controls", body.id);
  button.append(...[...heading.childNodes].filter((node) => node !== anchor));
  heading.prepend(button);
  const setOpen: SetOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      body.removeAttribute("hidden");
    } else {
      body.setAttribute("hidden", "until-found");
    }
  };
  setters.set(body, setOpen);
  setOpen(body.dataset.section !== "closed");
  const onClick = (): void =>
    setOpen(button.getAttribute("aria-expanded") !== "true");
  // ページ内検索が閉じた中身に当たったとき: ブラウザが開く前にボタンの状態を合わせる
  const onBeforeMatch = (): void =>
    button.setAttribute("aria-expanded", "true");
  button.addEventListener("click", onClick);
  body.addEventListener("beforematch", onBeforeMatch);
  return () => {
    body.removeEventListener("beforematch", onBeforeMatch);
    heading.prepend(...button.childNodes);
    button.remove();
    body.removeAttribute("hidden");
    setters.delete(body);
  };
}

/** URL の `#ID`（まとめた HTML の `#/{文書のパス}#{ID}` も同じ）が指す要素を囲む閉じた節を、外側から開く */
function revealHashTarget(
  root: HTMLElement,
  setters: Map<HTMLElement, SetOpen>,
) {
  const id = rowIdFromHash(location.hash);
  const target = id
    ? [...root.querySelectorAll<HTMLElement>("[id]")].find(
        (element) => element.id === id,
      )
    : undefined;
  if (!target) {
    return;
  }
  for (
    let body = target.closest<HTMLElement>(".mdmark-section-body");
    body;
    body =
      body.parentElement?.closest<HTMLElement>(".mdmark-section-body") ?? null
  ) {
    setters.get(body)?.(true);
  }
  // 表の行へは、`attachTables` が絞り込みを外してから送る
  if (target.tagName !== "TR") {
    target.scrollIntoView();
  }
}

/** 行の詳細を持つ行の先頭のセルに開閉のボタンを置き、詳細の行を閉じる。外す関数を返す */
function attachRowDetails(root: HTMLElement): () => void {
  const owners = new Map<HTMLTableRowElement, HTMLTableRowElement[]>();
  for (const detail of root.querySelectorAll<HTMLTableRowElement>(
    "tr.mdmark-row-detail",
  )) {
    let owner = detail.previousElementSibling;
    while (owner?.classList.contains("mdmark-row-detail")) {
      owner = owner.previousElementSibling;
    }
    if (owner instanceof HTMLTableRowElement) {
      owners.set(owner, [...(owners.get(owner) ?? []), detail]);
    }
  }
  const cleanups: Array<() => void> = [];
  for (const [owner, details] of owners) {
    const cell = owner.cells[0];
    if (!cell) {
      continue;
    }
    const label = visibleText(cell);
    const head = document.createElement("span");
    head.className = "mdmark-row-head";
    const button = document.createElement("button");
    button.className = "mdmark-row-toggle";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute(
      "aria-controls",
      details.map((detail) => detail.id).join(" "),
    );
    button.setAttribute("aria-label", `「${label}」の詳細`);
    head.append(button, ...cell.childNodes);
    cell.append(head);
    for (const detail of details) {
      detail.hidden = true;
    }
    const onClick = (): void => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      for (const detail of details) {
        detail.hidden = !open;
      }
    };
    button.addEventListener("click", onClick);
    cleanups.push(() => {
      cell.append(...[...head.childNodes].filter((node) => node !== button));
      head.remove();
      for (const detail of details) {
        detail.hidden = false;
      }
    });
  }
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/** `sections` がオンなら節の見出しを開閉のボタンにして閉じた節の中身を隠し、`row-details` がオンなら詳細を持つ行に開閉のボタンを置いて詳細の行を閉じる。URL の `#ID` が閉じた節の中を指すとき（付けたときと `hashchange`）にその節を開く */
export function attachSections(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 節の開閉の機能 */
  sections: boolean;
  /** 行の詳細の機能 */
  rowDetails: boolean;
}): () => void {
  const { root, sections, rowDetails } = options;
  const cleanups: Array<() => void> = [];
  if (sections) {
    const setters = new Map<HTMLElement, SetOpen>();
    for (const heading of root.querySelectorAll<HTMLElement>(
      ".mdmark-heading",
    )) {
      const body = heading.nextElementSibling;
      if (
        body instanceof HTMLElement &&
        body.classList.contains("mdmark-section-body")
      ) {
        cleanups.push(attachSection(heading, body, setters));
      }
    }
    const onHashChange = (): void => revealHashTarget(root, setters);
    window.addEventListener("hashchange", onHashChange);
    cleanups.push(() => window.removeEventListener("hashchange", onHashChange));
    revealHashTarget(root, setters);
  }
  if (rowDetails) {
    cleanups.push(attachRowDetails(root));
  }
  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}
