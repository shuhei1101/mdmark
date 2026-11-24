import { loadPartModule } from "../part-modules.ts";
import { renderNotice } from "../shared/notice.part.ts";
import type { CommentsController } from "./index.ts";
import {
  isComment,
  type MdmarkComment,
  type MdmarkCommentDraft,
  type MdmarkCommentStore,
} from "./spec.ts";

/** コメントの編集のイベントの値 */
export type MdmarkCommentEditDetail = {
  /** 編集したコメントの `id` */
  id: string;
  /** 確定した本文 */
  body: string;
};

/** コメントの削除のイベントの値 */
export type MdmarkCommentRemoveDetail = {
  /** 削除するコメントの `id` */
  id: string;
};

/** カスタム要素の名前 */
export const COMMENTS_ELEMENT_NAME = "mdmark-comments";

/** 読み込みと保存の関数に指定する対象の ID（要素ごとに 1 つの対象） */
const ELEMENT_DOC_ID = "element";

/** 代入を受け取るプロパティ */
const PROPERTIES = ["comments", "editable", "removable"] as const;

/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

/** 指定の誤り */
type CommentsIssue = { name: string; reason: string };

/** `comments`・`editable`・`removable` を確かめ、誤りがあれば最初の 1 つを返却する */
const checkComments = (options: {
  comments: unknown;
  editable: unknown;
  removable: unknown;
}): CommentsIssue | undefined => {
  const { comments, editable, removable } = options;
  if (!Array.isArray(comments)) {
    return {
      name: "comments",
      reason: "はコメントの配列で指定してください。",
    };
  }
  const ids = new Set<string>();
  for (const [index, comment] of comments.entries()) {
    if (!isComment(comment)) {
      return {
        name: `comments[${index}]`,
        reason:
          "は id・quote・prefix・suffix・body を持つコメントで指定してください。",
      };
    }
    if (ids.has(comment.id)) {
      return {
        name: `comments[${index}].id`,
        reason:
          "がほかのコメントと重なっています。コメントごとに異なる id にしてください。",
      };
    }
    ids.add(comment.id);
  }
  for (const [name, value] of [
    ["editable", editable],
    ["removable", removable],
  ] as const) {
    if (typeof value !== "boolean") {
      return { name, reason: "は true か false で指定してください。" };
    }
  }
  return undefined;
};

/** 付いたコメントを代入すると、子の本文にコメントの操作を付け直し、保存・編集・削除をイベントで送信するカスタム要素 */
export class MdmarkCommentsElement extends BaseElement {
  #comments: MdmarkComment[] | undefined;
  #editable: boolean = false;
  #removable: boolean = false;
  #pending = false;
  #controller: CommentsController | undefined;
  #notice: HTMLElement | undefined;
  /** 付け直しの番号。部品のモジュールを待つ間に次の付け直しが始まったら、前の付け直しをやめる */
  #attaches = 0;

  /** 付いたコメント */
  get comments(): MdmarkComment[] | undefined {
    return this.#comments;
  }

  set comments(value: MdmarkComment[] | undefined) {
    this.#comments = value;
    this.scheduleAttach();
  }

  /** 吹き出しに「編集」を出すか */
  get editable(): boolean {
    return this.#editable;
  }

  set editable(value: boolean) {
    this.#editable = value;
    this.scheduleAttach();
  }

  /** 吹き出しに「削除」を出すか */
  get removable(): boolean {
    return this.#removable;
  }

  set removable(value: boolean) {
    this.#removable = value;
    this.scheduleAttach();
  }

  /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、付け直しを予約する */
  connectedCallback(): void {
    for (const name of PROPERTIES) {
      if (Object.hasOwn(this, name)) {
        const value: unknown = (this as Record<string, unknown>)[name];
        delete (this as Record<string, unknown>)[name];
        (this as Record<string, unknown>)[name] = value;
      }
    }
    this.scheduleAttach();
  }

  /** マーカーを削除して文字を元に戻し、`document` の受け取りを解除する */
  disconnectedCallback(): void {
    this.#attaches += 1;
    this.#controller?.detach();
    this.#controller = undefined;
  }

  /** 付け直しを次のマイクロタスクに 1 回だけ予約する */
  scheduleAttach(): void {
    if (this.#pending) {
      return;
    }
    this.#pending = true;
    queueMicrotask(() => {
      void this.attachNow();
    });
  }

  /** 指定を確認し、誤りがあれば先頭に通知ブロックを配置し、無ければイベントを送信する読み込みと保存の関数で `attachComments` を呼ぶ */
  async attachNow(): Promise<void> {
    this.#pending = false;
    if (!this.isConnected || this.#comments === undefined) {
      return;
    }
    this.#attaches += 1;
    const attach = this.#attaches;
    this.#notice?.remove();
    this.#notice = undefined;
    this.#controller?.detach();
    this.#controller = undefined;
    const issue = checkComments({
      comments: this.#comments,
      editable: this.#editable,
      removable: this.#removable,
    });
    if (issue) {
      this.#showNotice(
        renderNotice({
          name: issue.name,
          figure: false,
          source: "data",
          reason: issue.reason,
        }),
      );
      return;
    }
    const comments = [...this.#comments];
    const controller = await this.#attachModule(comments);
    if (!controller) {
      return;
    }
    if (attach !== this.#attaches || !this.isConnected) {
      controller.detach();
      return;
    }
    this.#controller = controller;
  }

  /** コメントの部品のモジュールを読み込み、イベントを送信する読み込みと保存の関数で `attachComments` を呼ぶ。読み込めなければ通知ブロックを配置して `undefined` を返却する */
  async #attachModule(
    comments: MdmarkComment[],
  ): Promise<CommentsController | undefined> {
    try {
      const { module } = await loadPartModule("comments");
      return await module.attachComments({
        root: this,
        store: this.#store(comments),
        docId: ELEMENT_DOC_ID,
        closeOnEvent: true,
      });
    } catch {
      this.#showNotice(
        renderNotice({ name: "comments", figure: false, source: "part" }),
      );
      return undefined;
    }
  }

  /** `load` は指定されたコメントを返却し、保存・修正・削除はそれぞれのイベントを送信する読み込みと保存の関数 */
  #store(comments: MdmarkComment[]): MdmarkCommentStore {
    const send = <T>(type: string, detail: T): void => {
      this.dispatchEvent(
        new CustomEvent<T>(type, { detail, bubbles: true, composed: true }),
      );
    };
    return {
      load: async () => comments,
      save: async ({ comment }) => {
        send<MdmarkCommentDraft>("mdmark-comment-save", comment);
        return { id: "", ...comment };
      },
      ...(this.#editable
        ? {
            update: async ({ id, body }: { id: string; body: string }) => {
              send<MdmarkCommentEditDetail>("mdmark-comment-edit", {
                id,
                body,
              });
            },
          }
        : {}),
      ...(this.#removable
        ? {
            remove: async ({ id }: { id: string }) => {
              send<MdmarkCommentRemoveDetail>("mdmark-comment-remove", { id });
            },
          }
        : {}),
    };
  }

  /** 要素の子の本文を残し、先頭に通知ブロックを配置する */
  #showNotice(html: string): void {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    const notice = holder.firstElementChild;
    if (notice instanceof HTMLElement) {
      this.prepend(notice);
      this.#notice = notice;
    }
  }
}

/** 登録先に `mdmark-comments` が登録されていなければ `MdmarkCommentsElement` を登録する */
export const defineCommentsElement = (
  registry: CustomElementRegistry,
): void => {
  if (registry.get(COMMENTS_ELEMENT_NAME) === undefined) {
    registry.define(COMMENTS_ELEMENT_NAME, MdmarkCommentsElement);
  }
};
