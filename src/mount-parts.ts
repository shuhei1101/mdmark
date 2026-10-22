import {
  checkCommentOptions,
  type MdmarkCommentStore,
  type MdmarkCommentsHandle,
} from "./comments/spec.ts";
import { loadPartModule, type PartName } from "./part-modules.ts";
import { renderNotice } from "./parts/notice.ts";
import {
  checkViewOptions,
  type MdmarkViewHandle,
  type MdmarkViewOptions,
} from "./views/spec.ts";

/** `mountView` と `mountComments` が呼んだ要素から、まだ片付けていない戻り値を引く。同じ要素への 2 回目の呼び出しが前を片付けるのに使う */
const mountedViews = new WeakMap<HTMLElement, MdmarkViewHandle>();
const mountedComments = new WeakMap<HTMLElement, MdmarkCommentsHandle>();

/** 部品の読み込みの失敗を `console.error` に出した URL（部品ごとにページの中で 1 回だけ出すのに使う） */
const reportedFailures = new Set<string>();

/** 読めなかった部品の名前・URL・元のエラーを `console.error` に出す */
function reportLoadFailure(name: PartName, error: unknown): void {
  const url = error instanceof Error ? String(error.cause ?? "") : "";
  console.error("[mdmark] 部品のモジュールを読めません", name, url, error);
}

/** 呼び出しの戻り値の片付けの関数を、2 回目以降は何もしない関数に包む */
function once(detach: () => void): () => void {
  let done = false;
  return () => {
    if (!done) {
      done = true;
      detach();
    }
  };
}

/** 要素の中にビューを描く。引数を同期で検め、ビューの部品のモジュールを読んで描く */
export function mountView(
  el: HTMLElement,
  opts: MdmarkViewOptions,
): Promise<MdmarkViewHandle> {
  checkViewOptions(el, opts);
  // 同じ要素へ 2 回目の呼び出しは、前を先に片付ける
  mountedViews.get(el)?.destroy();
  let stop: (() => void) | undefined;
  let destroyed = false;
  const handle: MdmarkViewHandle = {
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      stop?.();
      if (mountedViews.get(el) === handle) {
        mountedViews.delete(el);
      }
    },
  };
  mountedViews.set(el, handle);
  return loadPartModule("view").then(
    ({ module }) => {
      // 読み込みを待つ間に片付けたら、描かない
      if (!destroyed) {
        stop = once(module.drawView(el, opts));
      }
      return handle;
    },
    (error: unknown) => {
      destroyed = true;
      mountedViews.delete(el);
      const notice = document.createElement("div");
      notice.className = "mdmark";
      notice.innerHTML = renderNotice({
        name: "view",
        figure: false,
        source: "part",
      });
      el.replaceChildren(notice);
      reportLoadFailure("view", error);
      throw error;
    },
  );
}

/** 要素の中の選んだ箇所にコメントを付けられるようにする。引数を同期で検め、コメントの部品のモジュールを読んで付ける */
export function mountComments(
  el: HTMLElement,
  opts: { store: MdmarkCommentStore; docId: string },
): Promise<MdmarkCommentsHandle> {
  checkCommentOptions(el, opts);
  mountedComments.get(el)?.destroy();
  let stop: (() => void) | undefined;
  let destroyed = false;
  const handle: MdmarkCommentsHandle = {
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      stop?.();
      if (mountedComments.get(el) === handle) {
        mountedComments.delete(el);
      }
    },
  };
  mountedComments.set(el, handle);
  return loadPartModule("comments").then(
    async ({ module }) => {
      if (destroyed) {
        return handle;
      }
      const detach = once(
        await module.attachComments({
          root: el,
          store: opts.store,
          docId: opts.docId,
        }),
      );
      // 読み込みを待つ間に片付けたら、付けた印をすぐ外す
      if (destroyed) {
        detach();
      } else {
        stop = detach;
      }
      return handle;
    },
    (error: unknown) => {
      destroyed = true;
      mountedComments.delete(el);
      throw error;
    },
  );
}

/** `attachParts` に渡す、`mount` ごとに 1 つ作る控え */
export type PartsWarned = {
  /** コメントの機能に読み書きの関数が要ることを出したか */
  missingStore: boolean;
};

/** `mount` が描くたびに呼ぶ。ビューの印とコメントの機能があるときだけ部品のモジュールを読んで付け、外す関数を返す */
export function attachParts(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 文書で決まった機能のオン・オフ */
  features: Record<string, boolean>;
  /** `mount` に渡されたコメントの読み書きの関数 */
  commentStore?: MdmarkCommentStore | undefined;
  /** `mount` に渡された文書の ID */
  docId?: string | undefined;
  /** 描いた文書がまだ今のものか */
  isCurrent: () => boolean;
  /** `mount` ごとに控える、読み書きの関数が無いことを出したか */
  warned: PartsWarned;
}): () => void {
  const { root, features, commentStore, docId, isCurrent, warned } = options;
  const detachers: Array<() => void> = [];
  let detached = false;
  const active = (): boolean => !detached && isCurrent();
  /** 読めなかった部品を、ページの中で部品と URL ごとに 1 回だけ `console.error` に出す */
  const report = (name: PartName, error: unknown): void => {
    const key = `${name}:${error instanceof Error ? String(error.cause ?? "") : ""}`;
    if (!reportedFailures.has(key)) {
      reportedFailures.add(key);
      reportLoadFailure(name, error);
    }
  };

  if (features.views === true && root.querySelector("div.mdmark-view")) {
    loadPartModule("view")
      .then(({ module }) => {
        if (!active()) {
          return;
        }
        for (const view of root.querySelectorAll<HTMLElement>(
          "div.mdmark-view",
        )) {
          detachers.push(module.attachView(view));
        }
      })
      .catch((error: unknown) => report("view", error));
  }
  if (features.comments === true) {
    if (commentStore === undefined || docId === undefined) {
      if (!warned.missingStore) {
        warned.missingStore = true;
        console.error(
          "[mdmark] コメントの機能には、mount に commentStore（コメントの読み書きの関数）を渡す必要があります",
        );
      }
    } else {
      loadPartModule("comments")
        .then(async ({ module }) => {
          if (!active()) {
            return;
          }
          const detach = await module.attachComments({
            root,
            store: commentStore,
            docId,
          });
          // 待つ間に外したら、得た外す関数をすぐ呼ぶ
          if (active()) {
            detachers.push(detach);
          } else {
            detach();
          }
        })
        .catch((error: unknown) => report("comments", error));
    }
  }

  return () => {
    detached = true;
    for (const detach of detachers.splice(0).reverse()) {
      detach();
    }
    // 拡張の `draw` から呼んだ `mountView`・`mountComments` も片付ける
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      mountedViews.get(el)?.destroy();
      mountedComments.get(el)?.destroy();
    }
  };
}
