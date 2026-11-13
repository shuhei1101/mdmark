import { rowIdFromHash } from "../table-logic.ts";
import {
  type PartStates,
  partKey,
  recordOpen,
  startOpen,
} from "./part-states.ts";
import { revealTabTarget } from "./tabs.ts";
import { visibleText } from "./text.ts";

/** セクションの開閉を切り替える関数 */
type SetOpen = (open: boolean) => void;

/** 読者が開閉したセクションの開閉を、セクションの中身の `id` から引く記録。`marker` は記録したときの中身の `data-section` の値 */
export type SectionStates = Map<string, { open: boolean; marker: string }>;

/** セクションの開閉の関数の記録。`attachSections` が操作を付けたセクションの中身から、そのセクションを開くか閉じる関数を参照する。削除する関数が取り除く */
const sectionSetters = new WeakMap<HTMLElement, SetOpen>();

/** セクションの見出しの要素から、そのセクションの中身を引く記録。`attachSections` が付け、削除する関数が取り除く */
const headingBodies = new WeakMap<HTMLElement, HTMLElement>();

/** セクションの中身に入っている、操作を付けた入れ子のセクションの中身 */
function nestedBodies(body: HTMLElement): HTMLElement[] {
  return [...body.querySelectorAll<HTMLElement>(".mdmark-section-body")];
}

/** 差分のブロック（見出しを包む `div`） */
const DIFF_BLOCK = ".mdmark-diff-block";

/** セクションの中身の見出しを返却する。見出しと中身の間に差分を開くボタンなどが入っていても、手前の見出しをたどる。見出しが差分のブロックに包まれているときは、そのブロックの中の見出しを返却する */
function headingOf(body: HTMLElement): Element | null {
  let sibling = body.previousElementSibling;
  while (sibling && !sibling.classList.contains("mdmark-heading")) {
    const wrapped = sibling.matches(DIFF_BLOCK)
      ? sibling.querySelector(":scope > .mdmark-heading")
      : null;
    if (wrapped !== null) {
      return wrapped;
    }
    sibling = sibling.previousElementSibling;
  }
  return sibling;
}

/** 見出しのセクションの中身を返却する。見出しが差分のブロックに包まれているときは、そのブロックの次の兄弟を確認する */
function bodyOf(heading: HTMLElement): HTMLElement | null {
  const wrapper = heading.parentElement?.matches(DIFF_BLOCK)
    ? heading.parentElement
    : null;
  const body = (wrapper ?? heading).nextElementSibling;
  return body instanceof HTMLElement &&
    body.classList.contains("mdmark-section-body")
    ? body
    : null;
}

/** セクションの見出し 1 つを開閉のボタンにし、閉じたセクションの中身を隠す。記録があり、マーカーが記録したときと同じなら記録の開閉で始め、開閉を変えるたびに記録へ書く。削除する関数を返却する */
function attachSection(
  heading: HTMLElement,
  body: HTMLElement,
  states: SectionStates | undefined,
): () => void {
  const anchor = heading.querySelector(":scope > .mdmark-anchor");
  const button = document.createElement("button");
  button.className = "mdmark-section-toggle";
  button.type = "button";
  button.setAttribute("aria-controls", body.id);
  button.append(...[...heading.childNodes].filter((node) => node !== anchor));
  heading.prepend(button);
  const marker = body.dataset.section ?? "open";
  /** 読者が変えた開閉を記録へ書く */
  const remember = (open: boolean): void => {
    states?.set(body.id, { open, marker });
  };
  /** ボタンと中身を開閉の状態にする */
  const show = (open: boolean): void => {
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      body.removeAttribute("hidden");
    } else {
      body.setAttribute("hidden", "until-found");
    }
  };
  const setOpen: SetOpen = (open) => {
    show(open);
    remember(open);
  };
  sectionSetters.set(body, setOpen);
  headingBodies.set(heading, body);
  const saved = states?.get(body.id);
  show(saved?.marker === marker ? saved.open : marker !== "closed");
  /** そのセクションを今と逆の状態にし、中の入れ子の全てのセクションを同じ状態にする */
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
  // ページ内検索が閉じた中身に該当したとき: ブラウザが開く前にボタンの状態を合わせる
  const onBeforeMatch = (): void => {
    button.setAttribute("aria-expanded", "true");
    remember(true);
  };
  button.addEventListener("click", onClick);
  button.addEventListener("keydown", onKeyDown);
  body.addEventListener("beforematch", onBeforeMatch);
  return () => {
    body.removeEventListener("beforematch", onBeforeMatch);
    heading.prepend(...button.childNodes);
    button.remove();
    body.removeAttribute("hidden");
    sectionSetters.delete(body);
    headingBodies.delete(heading);
  };
}

/** 要素を囲む閉じたセクションを外側から開き、選ばれていないタブの中ならそのタブも選ぶ */
function openSectionsAndTabs(target: HTMLElement): void {
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
}

/** 要素を囲む閉じたセクションを外側から開き、要素がセクションの見出しなら見出し自身のセクションも開き、選ばれていないタブの中ならそのタブも選び、表の行（`tr`）でなければ `scrollIntoView` する。URL の `#ID` で移るときと右側の目次の項目で移るときに使用する */
export function revealTarget(target: HTMLElement): void {
  openSectionsAndTabs(target);
  const ownBody = headingBodies.get(target);
  if (ownBody) {
    sectionSetters.get(ownBody)?.(true);
  }
  // 表の行へは、`attachTables` が絞り込みを解除してから送信する
  if (target.tagName !== "TR") {
    target.scrollIntoView();
  }
}

/** 要素を囲む閉じたセクションとタブを開き、閉じた行の詳細の中なら、その行の開閉のボタンを押した状態にして詳細の行を出す。スクロールしない。コメントのマーカーへ移るときに使用する */
export function openEnclosing(target: HTMLElement): void {
  openSectionsAndTabs(target);
  const detail = target.closest<HTMLTableRowElement>("tr.mdmark-row-detail");
  if (!detail) {
    return;
  }
  let owner = detail.previousElementSibling;
  while (owner?.classList.contains("mdmark-row-detail")) {
    owner = owner.previousElementSibling;
  }
  const button = owner?.querySelector<HTMLButtonElement>(
    "button.mdmark-row-toggle",
  );
  if (!button) {
    return;
  }
  button.setAttribute("aria-expanded", "true");
  for (const id of (button.getAttribute("aria-controls") ?? "").split(" ")) {
    const row = id === "" ? null : document.getElementById(id);
    if (row) {
      row.hidden = false;
    }
  }
}

/** `root` の中の、操作を付けた全てのセクションを、`open` が `true` なら開く。`false` なら、見出しが h1 のセクションを開き、h2〜h4 のセクションを閉じる */
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

/** 行の詳細を持つ行の先頭のセルに開閉のボタンを配置し、詳細の行を閉じる。削除する関数を返却する */
function attachRowDetails(
  root: HTMLElement,
  partStates: PartStates | undefined,
): () => void {
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
  /** 表ごとの記録の鍵（表の中の行の詳細で使い回す） */
  const tableKeys = new Map<HTMLTableElement, string>();
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
    const table = owner.closest("table");
    const base =
      table === null || partStates === undefined
        ? undefined
        : (tableKeys.get(table) ??
          partKey({ root, part: table, kind: "row-detail" }));
    if (table !== null && base !== undefined) {
      tableKeys.set(table, base);
    }
    const key =
      base === undefined
        ? undefined
        : `${base}|${details[0]?.dataset.row ?? ""}`;
    /** 詳細の行を開閉し、ボタンの `aria-expanded` に写す */
    const setOpen = (open: boolean): void => {
      button.setAttribute("aria-expanded", String(open));
      for (const detail of details) {
        detail.hidden = !open;
      }
    };
    setOpen(
      key !== undefined &&
        startOpen({ states: partStates, key, marker: "", markerOpen: false }),
    );
    const onClick = (): void => {
      const open = button.getAttribute("aria-expanded") !== "true";
      setOpen(open);
      if (key !== undefined) {
        recordOpen({ states: partStates, key, open, marker: "" });
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

/** `sections` がオンならセクションの見出しを開閉のボタンにして閉じたセクションの中身を隠し、`row-details` がオンなら詳細を持つ行に開閉のボタンを配置して詳細の行を閉じる。URL の `#ID` が閉じたセクションの中を指すとき（`revealHash` が `true` のときの付けたときと、`hashchange`）にそのセクションを開く */
export function attachSections(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** セクションの開閉の機能 */
  sections: boolean;
  /** 行の詳細の機能 */
  rowDetails: boolean;
  /** セクションの開閉の記録（省くと記録しない） */
  states?: SectionStates;
  /** 部品の開閉の記録（省くと記録しない） */
  partStates?: PartStates;
  /** 付けたときに URL の `#ID` で開くか（既定 `true`） */
  revealHash?: boolean;
}): () => void {
  const {
    root,
    sections,
    rowDetails,
    states,
    partStates,
    revealHash = true,
  } = options;
  const cleanups: Array<() => void> = [];
  if (sections) {
    for (const heading of root.querySelectorAll<HTMLElement>(
      ".mdmark-heading",
    )) {
      const body = bodyOf(heading);
      if (body !== null) {
        cleanups.push(attachSection(heading, body, states));
      }
    }
    const onHashChange = (): void => revealHashTarget(root);
    window.addEventListener("hashchange", onHashChange);
    cleanups.push(() => window.removeEventListener("hashchange", onHashChange));
    if (revealHash) {
      revealHashTarget(root);
    }
  }
  if (rowDetails) {
    cleanups.push(attachRowDetails(root, partStates));
  }
  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}
