import { rowIdFromHash } from "../table-logic.ts";
import { revealTabTarget } from "./tabs.ts";
import { visibleText } from "./text.ts";

/** 節の開閉を切り替える関数 */
type SetOpen = (open: boolean) => void;

/** 節の開閉の関数の控え。`attachSections` が操作を付けた節の中身から、その節を開くか閉じる関数を引く。外す関数が取り除く */
const sectionSetters = new WeakMap<HTMLElement, SetOpen>();

/** 節の中身に入っている、操作を付けた入れ子の節の中身 */
function nestedBodies(body: HTMLElement): HTMLElement[] {
  return [...body.querySelectorAll<HTMLElement>(".mdmark-section-body")];
}

/** 節の中身の見出しを返す。見出しと中身の間に差分を開くボタンなどが入っていても、手前の見出しをたどる */
function headingOf(body: HTMLElement): Element | null {
  let sibling = body.previousElementSibling;
  while (sibling && !sibling.classList.contains("mdmark-heading")) {
    sibling = sibling.previousElementSibling;
  }
  return sibling;
}

/** 節の見出し 1 つを開閉のボタンにし、閉じた節の中身を隠す。外す関数を返す */
function attachSection(heading: HTMLElement, body: HTMLElement): () => void {
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
  sectionSetters.set(body, setOpen);
  setOpen(body.dataset.section !== "closed");
  /** その節を今と逆の状態にし、中の入れ子の全ての節を同じ状態にする */
  const toggleNested = (): void => {
    const open = button.getAttribute("aria-expanded") !== "true";
    setOpen(open);
    for (const inner of nestedBodies(body)) {
      sectionSetters.get(inner)?.(open);
    }
  };
  const onClick = (event: MouseEvent): void => {
    if (event.shiftKey) {
      toggleNested();
    } else {
      setOpen(button.getAttribute("aria-expanded") !== "true");
    }
  };
  // Firefox ではキーで押した click の shiftKey が立たないため、Shift を押しながらの Enter・Space は keydown で受ける
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.shiftKey && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleNested();
    }
  };
  // ページ内検索が閉じた中身に当たったとき: ブラウザが開く前にボタンの状態を合わせる
  const onBeforeMatch = (): void =>
    button.setAttribute("aria-expanded", "true");
  button.addEventListener("click", onClick);
  button.addEventListener("keydown", onKeyDown);
  body.addEventListener("beforematch", onBeforeMatch);
  return () => {
    body.removeEventListener("beforematch", onBeforeMatch);
    heading.prepend(...button.childNodes);
    button.remove();
    body.removeAttribute("hidden");
    sectionSetters.delete(body);
  };
}

/** 要素を囲む閉じた節を外側から開き、選ばれていないタブの中ならそのタブも選び、表の行（`tr`）でなければ `scrollIntoView` する。URL の `#ID` で移るときと右側の目次の項目で移るときに使う */
export function revealTarget(target: HTMLElement): void {
  const bodies: HTMLElement[] = [];
  for (
    let body = target.closest<HTMLElement>(".mdmark-section-body");
    body;
    body =
      body.parentElement?.closest<HTMLElement>(".mdmark-section-body") ?? null
  ) {
    bodies.unshift(body);
  }
  for (const body of bodies) {
    sectionSetters.get(body)?.(true);
  }
  // 選ばれていないタブの中にあれば、そのタブも選ぶ
  revealTabTarget(target);
  // 表の行へは、`attachTables` が絞り込みを外してから送る
  if (target.tagName !== "TR") {
    target.scrollIntoView();
  }
}

/** `root` の中の、操作を付けた全ての節を、`open` が `true` なら開く。`false` なら、見出しが h1 の節を開き、h2〜h4 の節を閉じる */
export function foldAllSections(options: {
  /** 描いた本文 */
  root: HTMLElement;
  /** 開くか */
  open: boolean;
}): void {
  const { root, open } = options;
  for (const body of root.querySelectorAll<HTMLElement>(
    ".mdmark-section-body",
  )) {
    sectionSetters.get(body)?.(open || headingOf(body)?.tagName === "H1");
  }
}

/** URL の `#ID`（まとめた HTML の `#/{文書のパス}#{ID}` も同じ）が指す要素があれば、その要素へ移る */
function revealHashTarget(root: HTMLElement): void {
  const id = rowIdFromHash(location.hash);
  const target = id
    ? [...root.querySelectorAll<HTMLElement>("[id]")].find(
        (element) => element.id === id,
      )
    : undefined;
  if (target) {
    revealTarget(target);
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
    for (const heading of root.querySelectorAll<HTMLElement>(
      ".mdmark-heading",
    )) {
      const body = heading.nextElementSibling;
      if (
        body instanceof HTMLElement &&
        body.classList.contains("mdmark-section-body")
      ) {
        cleanups.push(attachSection(heading, body));
      }
    }
    const onHashChange = (): void => revealHashTarget(root);
    window.addEventListener("hashchange", onHashChange);
    cleanups.push(() => window.removeEventListener("hashchange", onHashChange));
    revealHashTarget(root);
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
