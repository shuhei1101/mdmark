import {
  type CommentFormState,
  type CommentRemoveState,
  renderCommentItem,
} from "../parts/comment.ts";
import type { MdmarkCommentStore } from "./spec.ts";

/** 入力欄か削除の確認を開いているコメント */
type OpenItem = {
  /** 入力欄か削除の確認か */
  kind: "edit" | "confirm";
  /** コメントの `id` */
  id: string;
  /** 開く前の本文 */
  body: string;
  /** 入力欄の本文の欄の通知を指す `id` の頭 */
  fieldId: string;
};

// 入力欄の本文の欄の `id` を文書の中で重ならせないための通し番号
let fieldCounter = 0;

/** HTML の文字から要素 1 つを作る */
function elementFrom(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 開いた吹き出しのコメントごとの「編集」「削除」に、入力欄・削除の確認と `store.update`・`store.remove` の呼び出しを付け、開いている入力欄か削除の確認を閉じる関数を返却する */
export function attachCommentActions(options: {
  /** `renderCommentBubble` で開いた吹き出し */
  bubble: HTMLElement;
  /** 読み込みと保存の関数 */
  store: MdmarkCommentStore;
  /** 対象の ID */
  docId: string;
  /** 付けたコメントがまだ削除されていないか */
  isActive: () => boolean;
  /** 修正できたときに通知する */
  onUpdated: (id: string, body: string) => void;
  /** 削除できたときに通知し、同じマーカーにコメントが残るかを受け取る */
  onRemoved: (id: string) => boolean;
}): { cancel: () => boolean } {
  const { bubble, store, docId, isActive, onUpdated, onRemoved } = options;
  const canEdit = typeof store.update === "function";
  const canRemove = typeof store.remove === "function";
  let open: OpenItem | undefined;
  // 修正か削除を待っているか
  let busy = false;

  /** その `id` のコメントの `li` を返却する */
  const itemOf = (id: string): HTMLElement | null =>
    bubble.querySelector<HTMLElement>(
      `li[data-comment-id="${CSS.escape(id)}"]`,
    );
  /** その `id` の `li` を再描画し、描いた `li` を返却する */
  const redraw = (
    id: string,
    props: {
      body: string;
      edit?: { draft: string; state: CommentFormState; fieldId: string };
      confirm?: { state: CommentRemoveState };
    },
  ): HTMLElement | undefined => {
    const item = itemOf(id);
    if (!item) {
      return undefined;
    }
    const next = elementFrom(
      renderCommentItem({ id, canEdit, canRemove, ...props }),
    );
    item.replaceWith(next);
    return next;
  };
  /** 開いている入力欄か削除の確認を本文の表示に戻し、`focusAction` のボタンへフォーカスを移す */
  const close = (focusAction?: "edit" | "remove"): void => {
    if (!open) {
      return;
    }
    const { id, body } = open;
    open = undefined;
    const item = redraw(id, { body });
    if (focusAction) {
      item
        ?.querySelector<HTMLElement>(`[data-action="${focusAction}"]`)
        ?.focus();
    }
  };
  /** 本文の欄へフォーカスを移す */
  const focusField = (item: HTMLElement | undefined): void => {
    item?.querySelector("textarea")?.focus();
  };

  // ─── 修正 ───
  /** そのコメントを入力欄に替える */
  const openEdit = (id: string): void => {
    const body =
      itemOf(id)?.querySelector(".mdmark-comment-body")?.textContent ?? "";
    close();
    fieldCounter += 1;
    open = {
      kind: "edit",
      id,
      body,
      fieldId: `mdmark-comment-edit-${fieldCounter}`,
    };
    focusField(
      redraw(id, {
        body,
        edit: { draft: body, state: "idle", fieldId: open.fieldId },
      }),
    );
  };
  /** 保存先の処理を呼び、失敗したら（まだ付けたままなら）エラーを出して `false` を返却する */
  const runStore = async (
    call: () => Promise<unknown>,
    failure: { message: string; action: string; id: string },
  ): Promise<boolean> => {
    try {
      await call();
      return true;
    } catch (error) {
      if (isActive()) {
        console.error(
          `[mdmark] ${failure.message}`,
          failure.action,
          docId,
          failure.id,
          error,
        );
      }
      return false;
    }
  };
  /** 入力欄の本文で `store.update` を呼び、修正できたら本文の表示に戻す */
  const saveEdit = async (current: OpenItem): Promise<void> => {
    const update = store.update;
    const draft = itemOf(current.id)?.querySelector("textarea")?.value ?? "";
    const body = draft.trim();
    const edit = (state: CommentFormState) => ({
      draft,
      state,
      fieldId: current.fieldId,
    });
    if (body === "") {
      focusField(
        redraw(current.id, { body: current.body, edit: edit("empty") }),
      );
      return;
    }
    if (!update) {
      return;
    }
    busy = true;
    redraw(current.id, { body: current.body, edit: edit("saving") });
    const saved = await runStore(
      () => update({ docId, id: current.id, body }),
      { message: "コメントを修正できません", action: "update", id: current.id },
    );
    if (!isActive()) {
      return;
    }
    busy = false;
    if (!saved) {
      focusField(
        redraw(current.id, { body: current.body, edit: edit("failed") }),
      );
      return;
    }
    open = undefined;
    onUpdated(current.id, body);
    redraw(current.id, { body })
      ?.querySelector<HTMLElement>('[data-action="edit"]')
      ?.focus();
  };

  // ─── 削除 ───
  /** そのコメントの下に削除の確認を出す */
  const openConfirm = (id: string): void => {
    const body =
      itemOf(id)?.querySelector(".mdmark-comment-body")?.textContent ?? "";
    close();
    open = { kind: "confirm", id, body, fieldId: "" };
    redraw(id, { body, confirm: { state: "idle" } })
      ?.querySelector<HTMLElement>('[data-action="cancel-remove"]')
      ?.focus();
  };
  /** `store.remove` を呼び、削除できたら `li` を除いて隣のコメントへフォーカスを移す */
  const confirmRemove = async (current: OpenItem): Promise<void> => {
    const remove = store.remove;
    if (!remove) {
      return;
    }
    busy = true;
    redraw(current.id, { body: current.body, confirm: { state: "removing" } });
    const removed = await runStore(() => remove({ docId, id: current.id }), {
      message: "コメントを削除できません",
      action: "remove",
      id: current.id,
    });
    if (!isActive()) {
      return;
    }
    busy = false;
    if (!removed) {
      redraw(current.id, { body: current.body, confirm: { state: "failed" } })
        ?.querySelector<HTMLElement>('[data-action="confirm-remove"]')
        ?.focus();
      return;
    }
    open = undefined;
    if (onRemoved(current.id)) {
      removeItem(current.id);
    }
  };
  /** そのコメントの `li` を除き、隣のコメントのボタンへフォーカスを移す */
  const removeItem = (id: string): void => {
    const item = itemOf(id);
    const next = item?.nextElementSibling ?? item?.previousElementSibling;
    item?.remove();
    next?.querySelector<HTMLElement>("button")?.focus();
  };

  // ─── 受け取り ───
  const onClick = (event: Event): void => {
    const target = event.target;
    const button =
      target instanceof Element
        ? target.closest<HTMLElement>("button[data-action]")
        : null;
    const id = button
      ?.closest<HTMLElement>("li[data-comment-id]")
      ?.getAttribute("data-comment-id");
    if (!button || !id || busy) {
      return;
    }
    runAction(button.dataset.action, id);
  };
  /** ボタンの `data-action` の操作を、そのコメントに行う */
  const runAction = (action: string | undefined, id: string): void => {
    switch (action) {
      case "edit":
        openEdit(id);
        break;
      case "remove":
        openConfirm(id);
        break;
      case "cancel-edit":
        close("edit");
        break;
      case "cancel-remove":
        close("remove");
        break;
      case "confirm-remove":
        if (open?.kind === "confirm" && open.id === id) {
          void confirmRemove(open);
        }
        break;
    }
  };
  const onSubmit = (event: Event): void => {
    event.preventDefault();
    if (!busy && open?.kind === "edit") {
      void saveEdit(open);
    }
  };
  bubble.addEventListener("click", onClick);
  bubble.addEventListener("submit", onSubmit);

  return {
    cancel: () => {
      if (busy) {
        return true;
      }
      if (!open) {
        return false;
      }
      close(open.kind === "edit" ? "edit" : "remove");
      return true;
    },
  };
}
