import { afterEach, expect, inject, test, vi } from "vitest";
import type {
  MdmarkComment,
  MdmarkCommentDraft,
  MdmarkCommentEditDetail,
  MdmarkCommentRemoveDetail,
} from "../../../src/index.ts";

/** コメントのカスタム要素のプロパティ */
type CommentsElement = HTMLElement & {
  comments?: unknown;
  editable?: unknown;
  removable?: unknown;
};

/** 要素の中の本文 */
const TEXT = "導入の手順を整える。";

const placed: HTMLElement[] = [];
let built: Promise<unknown> | undefined;
let stylesheetLoaded: Promise<void> | undefined;

afterEach(() => {
  for (const element of placed.splice(0)) {
    element.remove();
  }
  window.getSelection()?.removeAllRanges();
  sessionStorage.clear();
});

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
const distUrl = (file: string): string =>
  `/@fs${inject("builtRoot")}/dist/${file}`;

/** ビルドした CSS と JS を 1 度だけ読み込み、部品のカスタム要素を登録した状態にする */
const loadBuilt = async (): Promise<void> => {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  await stylesheetLoaded;
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  await built;
};

/** 要素をページに配置し、後ろに文字 `後ろの段落` の `p` を続ける */
const place = <T extends HTMLElement>(element: T): T => {
  const wrapper = document.createElement("div");
  const after = document.createElement("p");
  after.className = "after";
  after.textContent = "後ろの段落";
  wrapper.append(element, after);
  document.body.append(wrapper);
  placed.push(wrapper);
  return element;
};

/** `導入の手順を整える。` の `p` を持つ <mdmark-comments> を配置する */
const createComments = async (): Promise<CommentsElement> => {
  await loadBuilt();
  const element = document.createElement("mdmark-comments") as CommentsElement;
  element.innerHTML = `<p>${TEXT}</p>`;
  return place(element);
};

/** 要素の中の最初の文字の範囲を選ぶ */
const select = (paragraph: Element, start: number, end: number): void => {
  const node = paragraph.firstChild;
  if (!node) {
    throw new Error("選ぶ文字が無い");
  }
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
};

/** 隠れていないコメントのボタン */
const visibleButton = (): HTMLElement | undefined => {
  const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
  return button && !button.hidden ? button : undefined;
};

/** 付いたマーカー */
const mark = (element: HTMLElement): HTMLElement | null =>
  element.querySelector<HTMLElement>("mark.mdmark-comment-mark");

// 選んだ文字にコメントを記載して保存すると保存のイベントを送信し、アプリが指定し直したコメントでマーカーを付ける（正常系）
test("test_normal", async () => {
  // 準備
  const element = await createComments();
  const saved: MdmarkComment[] = [];
  const drafts: MdmarkCommentDraft[] = [];
  element.addEventListener("mdmark-comment-save", (event) => {
    const draft = (event as CustomEvent<MdmarkCommentDraft>).detail;
    drafts.push(draft);
    saved.push({ id: `c-${saved.length + 1}`, ...draft });
    element.comments = [...saved];
  });
  element.comments = [];
  const outside = document.createElement("p");
  outside.textContent = "要素の外の文";
  place(outside);
  // 実行: 要素の外の文字を選ぶ
  select(outside, 0, 3);
  await new Promise((resolve) => setTimeout(resolve, 100));
  // 検証: ボタンは出ない
  expect(visibleButton()).toBeUndefined();
  // 実行: 要素の中の文字を選び、コメントを記載して保存する
  const paragraph = element.querySelector(":scope > p");
  if (!paragraph) {
    throw new Error("段落が無い");
  }
  select(paragraph, 0, 5);
  await vi.waitFor(() => expect(visibleButton()).toBeDefined());
  visibleButton()?.click();
  const form = document.querySelector<HTMLElement>(".mdmark-comment-form");
  const field = form?.querySelector("textarea");
  if (!form || !field) {
    throw new Error("入力欄が開かない");
  }
  field.value = "手順の数を <b>3</b> にする";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  form.querySelector<HTMLButtonElement>(".is-primary")?.click();
  // 検証: 保存のイベントが 1 回届き、指定し直したコメントでマーカーが付く
  expect(drafts).toHaveLength(1);
  expect(drafts[0]).toMatchObject({ quote: "導入の手順", prefix: "" });
  expect(drafts[0]?.body).toBe("手順の数を <b>3</b> にする");
  await vi.waitFor(() => expect(mark(element)?.textContent).toBe("導入の手順"));
  mark(element)?.click();
  const bubble = document.querySelector(".mdmark-comment-bubble");
  expect(bubble?.querySelector(".mdmark-comment-body")?.textContent).toBe(
    "手順の数を <b>3</b> にする",
  );
  expect(bubble?.querySelector("b")).toBeNull();
  // editable・removable を省くと「編集」「削除」を出さない
  expect(bubble?.querySelector('[data-action="edit"]')).toBeNull();
  expect(bubble?.querySelector('[data-action="remove"]')).toBeNull();
  expect(paragraph.textContent).toBe(TEXT);
});

// editable・removable を指定すると吹き出しに「編集」「削除」を出し、操作をイベントで送信する（正常系）
test("test_normal_when_edited_and_removed", async () => {
  // 準備
  const element = await createComments();
  let comments: MdmarkComment[] = [
    {
      id: "c-1",
      quote: "導入の手順",
      prefix: "",
      suffix: "を整える。",
      body: "手順の数を 3 にする",
    },
  ];
  const edits: MdmarkCommentEditDetail[] = [];
  const removes: MdmarkCommentRemoveDetail[] = [];
  element.addEventListener("mdmark-comment-edit", (event) => {
    const detail = (event as CustomEvent<MdmarkCommentEditDetail>).detail;
    edits.push(detail);
    comments = comments.map((item) =>
      item.id === detail.id ? { ...item, body: detail.body } : item,
    );
    element.comments = comments;
  });
  element.addEventListener("mdmark-comment-remove", (event) => {
    const detail = (event as CustomEvent<MdmarkCommentRemoveDetail>).detail;
    removes.push(detail);
    comments = comments.filter((item) => item.id !== detail.id);
    element.comments = comments;
  });
  element.editable = true;
  element.removable = true;
  element.comments = comments;
  await vi.waitFor(() => expect(mark(element)).not.toBeNull());
  // 実行: 吹き出しを開き、本文を編集して確定する
  mark(element)?.click();
  const bubble = () => document.querySelector(".mdmark-comment-bubble");
  expect(bubble()?.querySelector('[data-action="edit"]')).not.toBeNull();
  expect(bubble()?.querySelector('[data-action="remove"]')).not.toBeNull();
  bubble()?.querySelector<HTMLButtonElement>('[data-action="edit"]')?.click();
  const field = bubble()?.querySelector("textarea");
  if (!field) {
    throw new Error("編集欄が開かない");
  }
  field.value = "手順の数を 4 にする";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  bubble()?.querySelector<HTMLButtonElement>(".is-primary")?.click();
  // 検証
  expect(edits).toEqual([{ id: "c-1", body: "手順の数を 4 にする" }]);
  // 指定し直したコメントでマーカーを付け直すまで待つ
  await vi.waitFor(() => {
    mark(element)?.click();
    expect(bubble()?.querySelector(".mdmark-comment-body")?.textContent).toBe(
      "手順の数を 4 にする",
    );
  });
  // 実行: 削除を押して確定する
  bubble()?.querySelector<HTMLButtonElement>('[data-action="remove"]')?.click();
  bubble()
    ?.querySelector<HTMLButtonElement>('[data-action="confirm-remove"]')
    ?.click();
  // 検証
  expect(removes).toEqual([{ id: "c-1" }]);
  await vi.waitFor(() => expect(mark(element)).toBeNull());
  expect(element.querySelector(":scope > p")?.textContent).toBe(TEXT);
});

// 指定に誤りがあると、例外を投げずに本文の前へ通知ブロックを配置し、本文は残す（異常系）
test("test_error_when_data_invalid", async () => {
  // 準備
  const comment = {
    id: "c-1",
    quote: "導入の手順",
    prefix: "",
    suffix: "",
    body: "本文",
  };
  const cases: Array<{ value: unknown; name: string }> = [
    { value: "c-1", name: "comments" },
    { value: [comment, { ...comment }], name: "comments[1].id" },
  ];
  for (const { value, name } of cases) {
    const element = await createComments();
    // 実行
    expect(() => {
      element.comments = value;
    }).not.toThrow();
    // 検証
    await vi.waitFor(() =>
      expect(
        element.firstElementChild?.classList.contains("mdmark-notice"),
      ).toBe(true),
    );
    const notice = element.firstElementChild;
    expect(notice?.textContent).toContain("この箇所を表示できません");
    expect(notice?.innerHTML).toContain(`<code>${name}</code>`);
    expect(element.querySelector(":scope > p")?.textContent).toBe(TEXT);
    const paragraph = element.querySelector(":scope > p");
    if (paragraph) {
      select(paragraph, 0, 5);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(visibleButton()).toBeUndefined();
  }
});
