import {
  COMMENT_HINT_ID,
  COMMENT_MESSAGES,
  renderCommentBubble,
  renderCommentButton,
  renderCommentForm,
  renderCommentMark,
  renderCommentOrphans,
} from "../parts/comment.ts";
import {
  COMMENT_EXCLUDED,
  commentText,
  draftFromRange,
  locateComments,
} from "./anchor.ts";
import {
  isComment,
  type MdmarkComment,
  type MdmarkCommentStore,
} from "./spec.ts";

/** コメントの部品のモジュール（`dist/comments.js`）が export する関数 */
export type CommentsPartModule = {
  /** `mountComments` と `mount` が呼ぶ */
  attachComments: (options: {
    root: HTMLElement;
    store: MdmarkCommentStore;
    docId: string;
  }) => Promise<() => void>;
};

/** 選んだ文字の始まりと終わりが同じ 1 つに入っていればボタンを出すブロック */
const COMMENT_BLOCKS = "p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote";

/** 入力欄を開いている間の選んだ文字に当てる Custom Highlight の名前（CSS の `::highlight()` と揃える） */
const PENDING_HIGHLIGHT = "mdmark-comment-pending";

/** 本文がある入力欄を閉じるときの `window.confirm` の文 */
const DISCARD_MESSAGE = "書いたコメントを捨てて閉じますか？";

/** ボタン・入力欄・吹き出しを箇所から離す幅（px） */
const POPOVER_GAP_PX = 6;

/** ボタン・入力欄・吹き出しを画面の端から離す幅（px） */
const POPOVER_GUTTER_PX = 8;

/** 印の読み上げの説明の文 */
const HINT_TEXT = "コメントが付いた箇所";

// 印の説明を使っている `attachComments` の数。最後の 1 つが外れたら説明を取り除く
let hintUsers = 0;

// 入力欄と吹き出しの `id` を文書の中で重ならせないための通し番号
let popoverCounter = 0;

/** HTML の文字から要素 1 つを作る */
function elementFrom(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 枠を箇所の下に置き、下に収まらなければ上に置き、左右は画面の中に収める */
export function placePopover(options: {
  /** 置く枠 */
  element: HTMLElement;
  /** 箇所の矩形 */
  rect: DOMRect;
}): void {
  const { element, rect } = options;
  const left = Math.min(
    Math.max(rect.left, POPOVER_GUTTER_PX),
    window.innerWidth - element.offsetWidth - POPOVER_GUTTER_PX,
  );
  const below = rect.bottom + POPOVER_GAP_PX;
  const top =
    below + element.offsetHeight > window.innerHeight - POPOVER_GUTTER_PX
      ? Math.max(
          POPOVER_GUTTER_PX,
          rect.top - element.offsetHeight - POPOVER_GAP_PX,
        )
      : below;
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

/** 開いている入力欄か吹き出し */
type OpenPopover = {
  /** 枠の要素 */
  element: HTMLElement;
  /** 入力欄か吹き出しか */
  kind: "form" | "bubble";
  /** 元の箇所の矩形を返す（スクロールや幅の変化で付いていくのに使う） */
  anchor: () => DOMRect;
  /** 閉じたらフォーカスを戻す先 */
  returnTo: HTMLElement;
};

/** 範囲の端の要素から、同じ 1 つのコメントを付けられるブロックを返す。付けられなければ `undefined` */
function blockOf(root: HTMLElement, range: Range): HTMLElement | undefined {
  const closest = (node: Node): HTMLElement | null =>
    (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
      COMMENT_BLOCKS,
    ) ?? null;
  const start = closest(range.startContainer);
  const end = closest(range.endContainer);
  if (!start || start !== end || !root.contains(start)) {
    return undefined;
  }
  const excluded = (node: Node): boolean => {
    const found = (
      node instanceof Element ? node : node.parentElement
    )?.closest(COMMENT_EXCLUDED);
    return found != null && root.contains(found);
  };
  if (excluded(range.startContainer) || excluded(range.endContainer)) {
    return undefined;
  }
  return start;
}

/** 読んだコメントに印を付け、文字の選び・ボタン・入力欄・吹き出しの操作を付け、外す関数を返す */
export async function attachComments(options: {
  /** 範囲の要素 */
  root: HTMLElement;
  /** 読み書きの関数 */
  store: MdmarkCommentStore;
  /** 対象の ID */
  docId: string;
}): Promise<() => void> {
  const { root, store, docId } = options;
  let destroyed = false;
  let comments: MdmarkComment[] = [];
  // 印 → その印に付いたコメント
  const marked = new Map<HTMLElement, MdmarkComment[]>();
  let open: OpenPopover | undefined;
  let pending: Range | undefined;
  let frame = 0;

  // ─── 読み込み ───
  try {
    const loaded: unknown = await store.load({ docId });
    if (Array.isArray(loaded) && loaded.every(isComment)) {
      comments = loaded;
    } else {
      console.error("[mdmark] コメントを読み込めません", "load", docId, loaded);
    }
  } catch (error) {
    console.error("[mdmark] コメントを読み込めません", "load", docId, error);
  }

  // ─── 読み上げの説明 ───
  hintUsers += 1;
  if (document.getElementById(COMMENT_HINT_ID) === null) {
    const hint = document.createElement("span");
    hint.id = COMMENT_HINT_ID;
    hint.hidden = true;
    hint.textContent = HINT_TEXT;
    document.body.append(hint);
  }

  // ─── 印 ───
  /** 付けた印を外して中の文字の節に戻し、箇所が見つからないコメントの一覧を取り除く */
  const clearMarks = (): void => {
    for (const mark of marked.keys()) {
      mark.replaceWith(...mark.childNodes);
    }
    marked.clear();
    root.querySelector(":scope > .mdmark-comment-orphans")?.remove();
    root.normalize();
  };
  /** 文字の節の `start`〜`end` を印で包む */
  const wrap = (node: Text, start: number, end: number): HTMLElement => {
    let target = node;
    if (end < target.length) {
      target.splitText(end);
    }
    if (start > 0) {
      target = target.splitText(start);
    }
    const mark = elementFrom(renderCommentMark({ text: "" }));
    mark.textContent = "";
    target.replaceWith(mark);
    mark.append(target);
    return mark;
  };
  /** 読んだコメントの箇所を探して印を付け直し、見つからないものを末尾の一覧に出す */
  const applyMarks = (): void => {
    clearMarks();
    const { text, nodes } = commentText(root);
    const { anchors, orphans } = locateComments({ text, comments });
    // 文字の節の位置がずれないよう、後ろの箇所から包む
    for (const anchor of [...anchors].reverse()) {
      for (const { node, start } of [...nodes].reverse()) {
        const from = Math.max(anchor.start, start) - start;
        const to = Math.min(anchor.end, start + node.length) - start;
        if (from < to) {
          marked.set(wrap(node, from, to), anchor.comments);
        }
      }
    }
    popoverCounter += 1;
    const list = renderCommentOrphans({
      comments: orphans,
      id: `mdmark-comment-orphans-${popoverCounter}`,
    });
    if (list) {
      root.append(elementFrom(list));
    }
  };
  applyMarks();

  // ─── ボタン ───
  const addButton = elementFrom(renderCommentButton());
  addButton.hidden = true;
  /** ボタンの位置を、選んだ文字の終わりの下（収まらなければ上）にする */
  const placeButton = (rect: DOMRect): void => {
    const left = Math.min(
      Math.max(rect.right - addButton.offsetWidth, POPOVER_GUTTER_PX),
      window.innerWidth - addButton.offsetWidth - POPOVER_GUTTER_PX,
    );
    const below = rect.bottom + POPOVER_GAP_PX;
    addButton.style.left = `${left}px`;
    addButton.style.top = `${
      below + addButton.offsetHeight > window.innerHeight - POPOVER_GUTTER_PX
        ? rect.top - addButton.offsetHeight - POPOVER_GAP_PX
        : below
    }px`;
  };
  /** 選びに合わせてボタンを出し入れする。ボタンは選んだ文字のブロックの直後に置き、Tab で届くようにする */
  const syncButton = (): void => {
    frame = 0;
    if (destroyed || open) {
      return;
    }
    const selection = window.getSelection();
    const range =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? selection.getRangeAt(0)
        : undefined;
    const block =
      range && range.toString().trim() !== ""
        ? blockOf(root, range)
        : undefined;
    if (!range || !block) {
      // ボタンにフォーカスがあるうちは隠さない
      if (document.activeElement !== addButton) {
        addButton.hidden = true;
      }
      return;
    }
    pending = range.cloneRange();
    block.after(addButton);
    addButton.hidden = false;
    placeButton(range.getBoundingClientRect());
  };
  /** 選びの変わりを 1 フレームにまとめて受ける */
  const scheduleSync = (): void => {
    if (frame === 0) {
      frame = requestAnimationFrame(syncButton);
    }
  };

  // ─── 入力欄と吹き出しの閉じ方 ───
  /** 入力欄を閉じる。本文があるときは捨ててよいかを確かめ、閉じたら真を返す */
  const closeForm = (force: boolean): boolean => {
    if (open?.kind !== "form") {
      return true;
    }
    const field = open.element.querySelector("textarea");
    if (!force && field?.value.trim() && !window.confirm(DISCARD_MESSAGE)) {
      return false;
    }
    open.element.remove();
    open = undefined;
    if ("highlights" in CSS) {
      CSS.highlights.delete(PENDING_HIGHLIGHT);
    }
    return true;
  };
  /** 吹き出しを閉じる。`returnFocus` が真なら印へフォーカスを戻す */
  const closeBubble = (returnFocus: boolean): void => {
    if (open?.kind !== "bubble") {
      return;
    }
    const { element, returnTo } = open;
    element.remove();
    returnTo.setAttribute("aria-expanded", "false");
    open = undefined;
    if (returnFocus) {
      returnTo.focus();
    }
  };

  // ─── 入力欄 ───
  /** 入力欄の状態を DOM に書く */
  const setFormState = (
    form: HTMLElement,
    state: "idle" | "saving" | "empty" | "failed",
  ): void => {
    const field = form.querySelector("textarea");
    const error = form.querySelector<HTMLElement>(".mdmark-comment-error");
    const submit = form.querySelector<HTMLButtonElement>(".is-primary");
    const message = state === "empty" || state === "failed" ? state : undefined;
    if (error) {
      error.hidden = message === undefined;
      const text = error.querySelector("span");
      if (text) {
        text.textContent = message ? COMMENT_MESSAGES[message] : "";
      }
    }
    if (message) {
      field?.setAttribute("aria-invalid", "true");
    } else {
      field?.removeAttribute("aria-invalid");
    }
    if (submit) {
      submit.disabled = state === "saving";
      submit.textContent =
        state === "saving" ? "保存しています…" : "コメントを保存";
    }
    if (state === "saving") {
      form.setAttribute("aria-busy", "true");
    } else {
      form.removeAttribute("aria-busy");
    }
  };
  /** 保存の関数を呼び、保存できたら入力欄を閉じて選んだ箇所に印を付ける */
  const save = async (form: HTMLElement, range: Range): Promise<void> => {
    const field = form.querySelector("textarea");
    const body = field?.value.trim() ?? "";
    if (body === "") {
      setFormState(form, "empty");
      placePopover({ element: form, rect: range.getBoundingClientRect() });
      field?.focus();
      return;
    }
    setFormState(form, "saving");
    let saved: unknown;
    try {
      saved = await store.save({
        docId,
        comment: draftFromRange({ root, range, body }),
      });
      if (!isComment(saved)) {
        throw new Error("save が返した値がコメントの形に合いません");
      }
    } catch (error) {
      console.error("[mdmark] コメントを保存できません", "save", docId, error);
      if (!destroyed) {
        setFormState(form, "failed");
        placePopover({ element: form, rect: range.getBoundingClientRect() });
        field?.focus();
      }
      return;
    }
    if (destroyed) {
      return;
    }
    closeForm(true);
    window.getSelection()?.removeAllRanges();
    addButton.hidden = true;
    comments = [...comments, saved];
    applyMarks();
    const mark = [...marked].find(([, list]) =>
      list.some((comment) => comment.id === (saved as MdmarkComment).id),
    );
    mark?.[0].focus();
  };
  /** 選んだ範囲の下に入力欄を開く */
  const openForm = (range: Range): void => {
    if (open?.kind === "bubble") {
      closeBubble(false);
    }
    if (open) {
      return;
    }
    popoverCounter += 1;
    const quote = range.toString().trim();
    const form = elementFrom(
      renderCommentForm({
        quote,
        id: `mdmark-comment-form-${popoverCounter}`,
      }),
    );
    document.body.append(form);
    open = {
      element: form,
      kind: "form",
      anchor: () => range.getBoundingClientRect(),
      returnTo: addButton,
    };
    placePopover({ element: form, rect: range.getBoundingClientRect() });
    addButton.hidden = true;
    // 選びが入力欄へ移って消えても、選んだ箇所に色を残す。Custom Highlight API の無いブラウザでは色を残さない
    if ("highlights" in CSS) {
      CSS.highlights.set(PENDING_HIGHLIGHT, new Highlight(range));
    }
    form.querySelector("textarea")?.focus();
    form
      .querySelector('[data-action="cancel"]')
      ?.addEventListener("click", () => cancelForm());
    form.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void save(form, range);
    });
  };
  /** キャンセルか Esc で入力欄を閉じ、ボタンへフォーカスを戻す。捨てないと答えたときは残す */
  const cancelForm = (): void => {
    if (!closeForm(false)) {
      return;
    }
    addButton.hidden = false;
    if (pending) {
      placeButton(pending.getBoundingClientRect());
    }
    addButton.focus();
  };

  // ─── 吹き出し ───
  /** 印の下に、付いたコメントの吹き出しを開く */
  const openBubble = (mark: HTMLElement): void => {
    if (open?.kind === "form" && !closeForm(false)) {
      return;
    }
    closeBubble(false);
    const list = marked.get(mark) ?? [];
    const bubble = elementFrom(
      renderCommentBubble({
        quote: list[0]?.quote ?? mark.textContent ?? "",
        bodies: list.map((comment) => comment.body),
      }),
    );
    document.body.append(bubble);
    open = {
      element: bubble,
      kind: "bubble",
      anchor: () => mark.getBoundingClientRect(),
      returnTo: mark,
    };
    mark.setAttribute("aria-expanded", "true");
    placePopover({ element: bubble, rect: mark.getBoundingClientRect() });
    bubble
      .querySelector(".mdmark-comment-close")
      ?.addEventListener("click", () => closeBubble(true));
    bubble.focus();
  };

  // ─── 受け取り ───
  const markOf = (event: Event): HTMLElement | undefined => {
    const target = event.target;
    const mark =
      target instanceof Element
        ? target.closest<HTMLElement>("mark.mdmark-comment-mark")
        : null;
    return mark && marked.has(mark) ? mark : undefined;
  };
  const onClick = (event: Event): void => {
    const mark = markOf(event);
    if (mark) {
      openBubble(mark);
    }
  };
  const onKeyDownMark = (event: KeyboardEvent): void => {
    const mark = markOf(event);
    if (mark && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openBubble(mark);
    }
  };
  /** Esc: 開いている入力欄か吹き出しを閉じ、開いた元へフォーカスを戻す */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !open) {
      return;
    }
    if (open.kind === "form") {
      cancelForm();
    } else {
      closeBubble(true);
    }
  };
  /** 外側を押す: 吹き出しだけを閉じる（入力欄は書いた文字を失わないよう、キャンセルか Esc で閉じる） */
  const onPointerDown = (event: Event): void => {
    if (open?.kind !== "bubble") {
      return;
    }
    const target = event.target as Node;
    if (!open.element.contains(target) && !open.returnTo.contains(target)) {
      closeBubble(false);
    }
  };
  /** スクロールと幅の変化: 開いている枠を元の箇所に付いていかせる */
  const onFollow = (): void => {
    if (open) {
      placePopover({ element: open.element, rect: open.anchor() });
    } else {
      scheduleSync();
    }
  };
  const onButtonClick = (): void => {
    if (pending) {
      openForm(pending);
    }
  };
  addButton.addEventListener("click", onButtonClick);
  addButton.addEventListener("focusout", scheduleSync);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDownMark);
  document.addEventListener("selectionchange", scheduleSync);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("scroll", onFollow, true);
  window.addEventListener("resize", onFollow);

  return () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    cancelAnimationFrame(frame);
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDownMark);
    document.removeEventListener("selectionchange", scheduleSync);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("scroll", onFollow, true);
    window.removeEventListener("resize", onFollow);
    open?.element.remove();
    open = undefined;
    if ("highlights" in CSS) {
      CSS.highlights.delete(PENDING_HIGHLIGHT);
    }
    addButton.remove();
    clearMarks();
    hintUsers -= 1;
    if (hintUsers <= 0) {
      document.getElementById(COMMENT_HINT_ID)?.remove();
    }
  };
}
