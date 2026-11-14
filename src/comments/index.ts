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
import { attachCommentActions } from "./bubble.ts";
import { attachMarginMarkers } from "./margin.ts";
import {
  isComment,
  type MdmarkComment,
  type MdmarkCommentStore,
} from "./spec.ts";

/** `attachComments` の Promise の値 */
export type CommentsController = {
  /** マーカーを削除して文字を元に戻し、配置した要素と受け取りを解除する。2 回目以降は何もしない */
  detach: () => void;
  /** `load` をもう一度呼んでマーカーをもう一度付ける */
  reload: () => Promise<void>;
  /** その `id` のコメントのマーカーへ移って強調する */
  focus: (id: string) => void;
};

/** コメントの部品のモジュール（`dist/comments.js`）が export する関数 */
export type CommentsPartModule = {
  /** `mountComments` と `mount` が呼ぶ */
  attachComments: (options: {
    root: HTMLElement;
    store: MdmarkCommentStore;
    docId: string;
    reveal?: (element: HTMLElement) => void;
    margin?: boolean;
  }) => Promise<CommentsController>;
};

/** 選んだ文字の始まりと終わりが同じ 1 つに入っていればボタンを出すブロック */
const COMMENT_BLOCKS = "p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote";

/** 入力欄を開いている間の選んだ文字に適用する Custom Highlight の名前（CSS の `::highlight()` と統一する） */
const PENDING_HIGHLIGHT = "mdmark-comment-pending";

/** 本文がある入力欄を閉じるときの `window.confirm` の文 */
const DISCARD_MESSAGE = "記載したコメントを捨てて閉じますか？";

/** ボタン・入力欄・吹き出しを箇所から離す幅（px） */
const POPOVER_GAP_PX = 6;

/** ボタン・入力欄・吹き出しを画面の端から離す幅（px） */
const POPOVER_GUTTER_PX = 8;

/** マーカーのスクリーンリーダーの説明の文 */
const HINT_TEXT = "コメントが付いた箇所";

// マーカーの説明を使用している `attachComments` の数。最後の 1 つが削除されたら説明を取り除く
let hintUsers = 0;

// 入力欄と吹き出しの `id` を文書の中で重ならせないための通し番号
let popoverCounter = 0;

/** HTML の文字から要素 1 つを作る */
function elementFrom(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 枠を箇所の下に配置し、下に収まらなければ上に配置し、左右は画面の中に収める */
export function placePopover(options: {
  /** 配置する枠 */
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
  /** 元の箇所の矩形を返却する（スクロールや幅の変化で付いていくのに使用する） */
  anchor: () => DOMRect;
  /** 閉じたらフォーカスを戻す先 */
  returnTo: HTMLElement;
};

/** 今の選びの範囲と、その範囲にコメントを付けられるブロック。選びが無い・空・付けられないときは無い */
function selectedBlock(root: HTMLElement): {
  range?: Range;
  block?: HTMLElement;
} {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return {};
  }
  const range = selection.getRangeAt(0);
  if (range.toString().trim() === "") {
    return { range };
  }
  return { range, block: blockOf(root, range) };
}

/** 真なら属性に `true` を入れ、偽なら属性を削除する */
function setFlag(element: Element | null, name: string, on: boolean): void {
  if (on) {
    element?.setAttribute(name, "true");
  } else {
    element?.removeAttribute(name);
  }
}

/** 入力欄の状態を DOM に記載する */
function setFormState(
  form: HTMLElement,
  state: "idle" | "saving" | "empty" | "failed",
): void {
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
  setFlag(
    form.querySelector("textarea"),
    "aria-invalid",
    message !== undefined,
  );
  if (submit) {
    submit.disabled = state === "saving";
    submit.textContent =
      state === "saving" ? "保存しています…" : "コメントを保存";
  }
  setFlag(form, "aria-busy", state === "saving");
}

/** 範囲の端の要素から、同じ 1 つのコメントを付けられるブロックを返却する。付けられなければ `undefined` */
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

/** 読み込んだコメントにマーカーを付け、文字の選び・ボタン・入力欄・吹き出しの操作を付け、削除する関数を返却する */
export async function attachComments(options: {
  /** 範囲の要素 */
  root: HTMLElement;
  /** 読み込みと保存の関数 */
  store: MdmarkCommentStore;
  /** 対象の ID */
  docId: string;
  /** マーカーを囲む閉じたセクションと行の詳細を開く */
  reveal?: (element: HTMLElement) => void;
  /** 余白のマーカーを配置するか（既定 `false`） */
  margin?: boolean;
}): Promise<CommentsController> {
  const { root, store, docId, reveal, margin = false } = options;
  let destroyed = false;
  let comments: MdmarkComment[] = [];
  // マーカー → そのマーカーに付いたコメント
  const marked = new Map<HTMLElement, MdmarkComment[]>();
  let open: OpenPopover | undefined;
  // 開いている吹き出しの修正と削除の操作
  let actions: { cancel: () => boolean } | undefined;
  let pending: Range | undefined;
  let frame = 0;
  // 再読み込みの番号。後から再読み込みしたら前の再読み込みの結果を捨てる
  let reloadCount = 0;

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

  // ─── スクリーンリーダーの説明 ───
  hintUsers += 1;
  if (document.getElementById(COMMENT_HINT_ID) === null) {
    const hint = document.createElement("span");
    hint.id = COMMENT_HINT_ID;
    hint.hidden = true;
    hint.textContent = HINT_TEXT;
    document.body.append(hint);
  }

  // ─── マーカー ───
  /** 付けたマーカーを削除して中の文字のセクションに戻し、箇所が見つからないコメントの一覧を取り除く */
  const clearMarks = (): void => {
    for (const mark of marked.keys()) {
      mark.replaceWith(...mark.childNodes);
    }
    marked.clear();
    root.querySelector(":scope > .mdmark-comment-orphans")?.remove();
    root.normalize();
  };
  /** 文字のセクションの `start`〜`end` をマーカーで包む */
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
  /** 読み込んだコメントの箇所を探してマーカーをもう一度付け、見つからないものを末尾の一覧に出す */
  const applyMarks = (): void => {
    clearMarks();
    const { text, nodes } = commentText(root);
    const { anchors, orphans } = locateComments({ text, comments });
    // 文字のセクションの位置がずれないよう、後ろの箇所から包む
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
  /** 選びに合わせてボタンを出し入れする。ボタンは選んだ文字のブロックの直後に配置し、Tab で届くようにする */
  const syncButton = (): void => {
    frame = 0;
    if (destroyed || open) {
      return;
    }
    const { range, block } = selectedBlock(root);
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
  /** 入力欄を閉じる。本文があるときは捨ててよいかを確認し、閉じたら真を返却する */
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
  /** 吹き出しを閉じる。`returnFocus` が真ならマーカーへフォーカスを戻す */
  const closeBubble = (returnFocus: boolean): void => {
    if (open?.kind !== "bubble") {
      return;
    }
    const { element, returnTo } = open;
    element.remove();
    returnTo.setAttribute("aria-expanded", "false");
    open = undefined;
    actions = undefined;
    if (returnFocus) {
      returnTo.focus();
    }
  };

  // ─── 入力欄 ───
  /** 保存の関数を呼び、保存できたら入力欄を閉じて選んだ箇所にマーカーを付ける */
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
    const saved = await saveComment(range, body);
    if (destroyed) {
      return;
    }
    if (saved === undefined) {
      setFormState(form, "failed");
      placePopover({ element: form, rect: range.getBoundingClientRect() });
      field?.focus();
      return;
    }
    closeForm(true);
    window.getSelection()?.removeAllRanges();
    addButton.hidden = true;
    comments = [...comments, saved];
    applyMarks();
    const mark = [...marked].find(([, list]) =>
      list.some((comment) => comment.id === saved.id),
    );
    mark?.[0].focus();
  };
  /** 保存の関数を呼び、保存できたコメントを返却する。保存できなければエラーを出して `undefined` */
  const saveComment = async (
    range: Range,
    body: string,
  ): Promise<MdmarkComment | undefined> => {
    try {
      const saved: unknown = await store.save({
        docId,
        comment: draftFromRange({ root, range, body }),
      });
      if (!isComment(saved)) {
        throw new Error("save が返却した値がコメントの構造に合いません");
      }
      return saved;
    } catch (error) {
      console.error("[mdmark] コメントを保存できません", "save", docId, error);
      return undefined;
    }
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
    if ("highlights" in CSS && typeof Highlight !== "undefined") {
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
  /** キャンセルか Esc で入力欄を閉じ、ボタンへフォーカスを戻す。捨てないと回答したときは残す */
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
  /** マーカーに付いたコメントの吹き出しの要素を作る */
  const renderBubble = (
    mark: HTMLElement,
    can: { canEdit: boolean; canRemove: boolean },
  ): HTMLElement => {
    const list = marked.get(mark) ?? [];
    return elementFrom(
      renderCommentBubble({
        quote: list[0]?.quote ?? mark.textContent ?? "",
        bodies: list.map((comment) => comment.body),
        ids: list.map((comment) => comment.id),
        ...can,
      }),
    );
  };
  /** マーカーの下に、付いたコメントの吹き出しを開く */
  const openBubble = (mark: HTMLElement): void => {
    if (open?.kind === "form" && !closeForm(false)) {
      return;
    }
    closeBubble(false);
    const canEdit = typeof store.update === "function";
    const canRemove = typeof store.remove === "function";
    const bubble = renderBubble(mark, { canEdit, canRemove });
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
    if (canEdit || canRemove) {
      actions = attachCommentActions({
        bubble,
        store,
        docId,
        isActive: () => !destroyed,
        onUpdated,
        onRemoved,
      });
    }
    bubble.focus();
  };

  // ─── 修正と削除の反映 ───
  /** 修正できたコメントの本文を、記録したコメントとマーカーに付いたコメントで書き換える */
  const onUpdated = (id: string, body: string): void => {
    const replace = (comment: MdmarkComment): MdmarkComment =>
      comment.id === id ? { ...comment, body } : comment;
    comments = comments.map(replace);
    for (const [mark, list] of marked) {
      marked.set(mark, list.map(replace));
    }
  };
  /** 削除できたコメントを除き、コメントが残らないマーカーは削除する。同じマーカーにコメントが残るかを返却する */
  const onRemoved = (id: string): boolean => {
    comments = comments.filter((comment) => comment.id !== id);
    let remains = true;
    for (const [mark, list] of [...marked]) {
      if (!list.some((comment) => comment.id === id)) {
        continue;
      }
      const rest = list.filter((comment) => comment.id !== id);
      if (rest.length > 0) {
        marked.set(mark, rest);
        continue;
      }
      // 開いている吹き出しのマーカーなら閉じ、フォーカスを移す先のブロックを記録してからマーカーを削除する
      remains = false;
      const wasOpen = open?.kind === "bubble" && open.returnTo === mark;
      if (wasOpen) {
        closeBubble(false);
      }
      const block = mark.parentElement?.closest<HTMLElement>(COMMENT_BLOCKS);
      marked.delete(mark);
      mark.replaceWith(...mark.childNodes);
      if (wasOpen && block) {
        block.setAttribute("tabindex", "-1");
        block.focus({ preventScroll: true });
      }
    }
    root.normalize();
    return remains;
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
    } else if (!actions?.cancel()) {
      closeBubble(true);
    }
  };
  /** 外側を押す: 吹き出しだけを閉じる（入力欄は記載した文字を失わないよう、キャンセルか Esc で閉じる） */
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
  const detachMargin =
    margin && root.matches("div.mdmark-content")
      ? attachMarginMarkers({ content: root })
      : undefined;

  // ─── 再読み込みとマーカーへ移る ───
  /** `load` をもう一度呼び、読み込めたらマーカーと一覧をもう一度付ける。読み込めなければマーカーを残して reject する */
  const reload = async (): Promise<void> => {
    reloadCount += 1;
    const count = reloadCount;
    let loaded: unknown;
    try {
      loaded = await store.load({ docId });
    } catch (error) {
      if (destroyed || count !== reloadCount) {
        return;
      }
      console.error("[mdmark] コメントを読み込めません", "load", docId, error);
      throw error;
    }
    if (destroyed || count !== reloadCount) {
      return;
    }
    if (!Array.isArray(loaded) || !loaded.every(isComment)) {
      console.error("[mdmark] コメントを読み込めません", "load", docId, loaded);
      throw new TypeError(
        "load が返却した値がコメントの配列の構造に合いません",
      );
    }
    comments = loaded;
    closeBubble(false);
    applyMarks();
  };
  /** その `id` のコメントのマーカーを開いて見せ、フォーカスを移して強調する */
  const focus = (id: string): void => {
    if (destroyed) {
      return;
    }
    const targets = [...marked]
      .filter(([, list]) => list.some((comment) => comment.id === id))
      .map(([mark]) => mark);
    const first = targets[0];
    if (!first) {
      return;
    }
    for (const mark of marked.keys()) {
      mark.removeAttribute("data-focused");
    }
    reveal?.(first);
    first.scrollIntoView({ block: "nearest" });
    first.focus();
    for (const mark of targets) {
      mark.setAttribute("data-focused", "");
    }
  };

  /** 受け取りを解除し、配置した要素とマーカーを取り除く */
  const detach = (): void => {
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
    detachMargin?.();
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

  return { detach, reload, focus };
}
