import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  addStyles,
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 脚注の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFootnotes = () => import("../../../../src/interact/footnotes.ts");

/** セクションと行の詳細の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSections = () => import("../../../../src/interact/sections.ts");

/** 脚注の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFootnotePart = () => import("../../../../src/parts/footnote.ts");

const detachers: Array<() => void> = [];

/** 脚注 1 つの番号を持つ段落と、閉じた一覧の HTML */
async function footnoteHtml(): Promise<string> {
  const { renderFootnoteRef, renderFootnotes } = await loadFootnotePart();
  const ref = renderFootnoteRef({ number: 1, bodies: ["補足の中身。"] });
  const list = renderFootnotes({
    items: [{ number: 1, html: "<p>補足の中身。</p>", refCount: 1 }],
  });
  return `<p>本文${ref}。</p>${list}`;
}

/** 今フォーカスのある要素にキーを押す */
function press(key: string): void {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true }),
  );
}

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.useRealTimers();
});

/** 中身にリンクを持つ脚注 1 つの番号を持つ段落と、閉じた一覧の HTML */
async function footnoteWithLinkHtml(): Promise<string> {
  const { renderFootnoteRef, renderFootnotes } = await loadFootnotePart();
  const body = '補足の<a href="#detail">詳しく</a>。';
  const ref = renderFootnoteRef({ number: 1, bodies: [body] });
  const list = renderFootnotes({
    items: [{ number: 1, html: `<p>${body}</p>`, refCount: 1 }],
  });
  return `<p>本文${ref}。</p>${list}`;
}

/** ポインターの種類を指定したポインターのイベント */
function pointer(type: string, pointerType: string): PointerEvent {
  return new PointerEvent(type, {
    pointerType,
    bubbles: type === "pointerdown" || type === "pointerup",
  });
}

/** 取り消せる `click` を送信し、既定の動作が止められたかを返却する */
function click(element: HTMLElement): boolean {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * 番号のリンクへのタッチのタップを、実際の順序（`pointerenter`・`pointerdown`・`pointerup`・`pointerleave` の後にフォーカスと `click`）で発生させ、`click` の既定の動作が止められたかを返却する。
 * `pointerenter`・`pointerleave` は泡立たないため、ブラウザと同じく `sup` とリンクの両方に送信する。
 * `focus()` は既にフォーカスを持つリンクでは `focus` を発火しない
 */
function tap(ref: HTMLElement, link: HTMLElement): boolean {
  ref.dispatchEvent(pointer("pointerenter", "touch"));
  link.dispatchEvent(pointer("pointerenter", "touch"));
  link.dispatchEvent(pointer("pointerdown", "touch"));
  link.dispatchEvent(pointer("pointerup", "touch"));
  link.dispatchEvent(pointer("pointerleave", "touch"));
  ref.dispatchEvent(pointer("pointerleave", "touch"));
  link.focus();
  return click(link);
}

/** 番号・リンク・一覧・項目を取り出す */
function footnoteParts(root: HTMLElement): {
  ref: HTMLElement;
  link: HTMLElement;
  list: HTMLDetailsElement;
  item: HTMLElement;
} {
  const ref = root.querySelector<HTMLElement>(".mdmark-fn-ref");
  const link = root.querySelector<HTMLElement>(".mdmark-fn-link");
  const list = root.querySelector<HTMLDetailsElement>(
    "details.mdmark-footnotes",
  );
  const item = root.querySelector<HTMLElement>(".mdmark-fn-item");
  if (!ref || !link || !list || !item) {
    throw new Error("脚注の番号と一覧が描かれていない");
  }
  return { ref, link, list, item };
}

// フォーカスで開き Esc で閉じる（正常系）
test("test_attach_footnotes", async () => {
  // 準備
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  const ref = root.querySelector<HTMLElement>(".mdmark-fn-ref");
  const link = root.querySelector<HTMLElement>(".mdmark-fn-link");
  // 実行・検証
  const detach = attachFootnotes({ root, placement: "top" });
  expect(ref?.classList.contains("is-open")).toBe(false);
  link?.focus();
  expect(ref?.classList.contains("is-open")).toBe(true);
  press("Escape");
  expect(ref?.classList.contains("is-open")).toBe(false);
  expect(ref?.classList.contains("is-dismissed")).toBe(true);
  expect(document.activeElement).toBe(link);
  detach();
  expect(ref?.className).toBe("mdmark-fn-ref");
});

// 番号で一覧の項目へ、戻るリンクで番号へ移る（正常系）
test("test_attach_footnotes_when_jump", async () => {
  // 準備
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const hash = location.hash;
  const ref = root.querySelector<HTMLElement>(".mdmark-fn-ref");
  const link = root.querySelector<HTMLElement>(".mdmark-fn-link");
  const list = root.querySelector<HTMLDetailsElement>(
    "details.mdmark-footnotes",
  );
  const item = root.querySelector<HTMLElement>(".mdmark-fn-item");
  const back = root.querySelector<HTMLElement>(".mdmark-fn-back");
  // 実行
  link?.click();
  // 検証
  expect(list?.open).toBe(true);
  expect(item?.getAttribute("tabindex")).toBe("-1");
  expect(document.activeElement).toBe(item);
  expect(ref?.classList.contains("is-open")).toBe(false);
  expect(location.hash).toBe(hash);
  // 実行
  back?.click();
  // 検証
  expect(document.activeElement).toBe(link);
  expect(location.hash).toBe(hash);
});

// 同じページに 2 回描いても id が重ならない（正常系）
test("test_attach_footnotes_unique_ids", async () => {
  // 準備
  const { attachFootnotes } = await loadFootnotes();
  const html = await footnoteHtml();
  const roots = [createRootFromHtml(html), createRootFromHtml(html)];
  // 実行
  for (const root of roots) {
    detachers.push(attachFootnotes({ root, placement: "top" }));
  }
  // 検証
  const ids = roots.flatMap((root) =>
    [...root.querySelectorAll("[id]")].map((element) => element.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (const root of roots) {
    const link = root.querySelector(".mdmark-fn-link");
    const tip = root.querySelector(".mdmark-fn-tip");
    const item = root.querySelector(".mdmark-fn-item");
    const back = root.querySelector(".mdmark-fn-back");
    const describedBy = link?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toBe(tip);
    expect(
      document.getElementById(link?.getAttribute("href")?.slice(1) ?? ""),
    ).toBe(item);
    expect(
      document.getElementById(back?.getAttribute("href")?.slice(1) ?? ""),
    ).toBe(link);
  }
});

// 閉じたセクションの中の番号へ、戻るリンクでセクションを開いて移る（正常系）
test("test_attach_footnotes_when_back_into_closed_section", async () => {
  // 準備
  const { attachFootnotes } = await loadFootnotes();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    '## セクション\n\n<!-- section: {"open": false} -->\n\n本文[^a]。\n\n[^a]: 補足\n',
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: false }));
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const body = root.querySelector<HTMLElement>(".mdmark-section-body");
  const link = root.querySelector<HTMLElement>(".mdmark-fn-link");
  const list = root.querySelector<HTMLDetailsElement>(
    "details.mdmark-footnotes",
  );
  if (list) {
    list.open = true;
  }
  expect(body?.hidden).toBeTruthy();
  // 実行
  root.querySelector<HTMLElement>(".mdmark-fn-back")?.click();
  // 検証
  expect(body?.hidden).toBeFalsy();
  expect(document.activeElement).toBe(link);
});

// タッチの 1 回目のタップで開いて一覧へ移らず、開いた番号のタップで一覧へ移る（正常系）
test("test_attach_footnotes_when_touch_tapped", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const { ref, link, list, item } = footnoteParts(root);
  // 実行
  const firstPrevented = tap(ref, link);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(ref.classList.contains("is-open")).toBe(true);
  expect(list.open).toBe(false);
  expect(firstPrevented).toBe(true);
  // 実行
  tap(ref, link);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(ref.classList.contains("is-open")).toBe(false);
  expect(list.open).toBe(true);
  expect(document.activeElement).toBe(item);
});

// タッチで開いた後、外の pointerdown だけで閉じ、ツールチップの中のリンクでは閉じない（正常系）
test("test_attach_footnotes_when_touch_outside", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteWithLinkHtml());
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const { ref, link } = footnoteParts(root);
  const inner = root.querySelector<HTMLElement>(".mdmark-fn-tip a");
  const outside = document.createElement("p");
  document.body.append(outside);
  detachers.push(() => outside.remove());
  tap(ref, link);
  // 実行: ツールチップの中のリンク
  inner?.dispatchEvent(pointer("pointerdown", "touch"));
  vi.advanceTimersByTime(1000);
  // 検証
  expect(ref.classList.contains("is-open")).toBe(true);
  // 実行: root の外（pointerleave・focusout は送信しない）
  outside.dispatchEvent(pointer("pointerdown", "touch"));
  vi.advanceTimersByTime(1000);
  // 検証: 番号にフォーカスが残ったままでも、ツールチップを出さない
  expect(ref.classList.contains("is-open")).toBe(false);
  expect(ref.classList.contains("is-dismissed")).toBe(true);
  expect(document.activeElement).toBe(link);
  const tip = ref.querySelector<HTMLElement>(".mdmark-fn-tip");
  expect(tip && getComputedStyle(tip).display).toBe("none");
});

// タップで一覧へ移った後も、同じ番号のタップでもう一度開く（正常系）
test("test_attach_footnotes_when_touch_reopened", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const { ref, link } = footnoteParts(root);
  tap(ref, link);
  tap(ref, link);
  vi.advanceTimersByTime(1000);
  // 実行
  const prevented = tap(ref, link);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(ref.classList.contains("is-dismissed")).toBe(false);
  expect(ref.classList.contains("is-open")).toBe(true);
  expect(prevented).toBe(true);
});

// マウスでは今のまま 1 回のクリックで一覧へ移る（正常系）
test("test_attach_footnotes_when_mouse_clicked", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const { ref, link, list, item } = footnoteParts(root);
  // 実行
  ref.dispatchEvent(pointer("pointerenter", "mouse"));
  link.dispatchEvent(pointer("pointerenter", "mouse"));
  link.dispatchEvent(pointer("pointerdown", "mouse"));
  link.dispatchEvent(pointer("pointerup", "mouse"));
  click(link);
  // 検証
  expect(ref.classList.contains("is-open")).toBe(false);
  expect(list.open).toBe(true);
  expect(document.activeElement).toBe(item);
});

// まとめた HTML が `href` に文書のパスを足しても、番号と戻るリンクで移る（正常系）
test("test_attach_footnotes_when_doc_path_in_href", async () => {
  // 準備
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const { link, list, item } = footnoteParts(root);
  const back = root.querySelector<HTMLElement>(".mdmark-fn-back");
  if (!back) {
    throw new Error("戻るリンクが描かれていない");
  }
  for (const anchor of [link, back]) {
    anchor.setAttribute("href", `#/doc.md${anchor.getAttribute("href") ?? ""}`);
  }
  // 実行
  const preventedByRef = click(link);
  // 検証
  expect(preventedByRef).toBe(true);
  expect(list.open).toBe(true);
  expect(document.activeElement).toBe(item);
  // 実行
  const preventedByBack = click(back);
  // 検証
  expect(preventedByBack).toBe(true);
  expect(document.activeElement).toBe(link);
});

// `root` に先に付いたバブリングフェーズの `click` より先に既定の動作を止める（正常系）
test("test_attach_footnotes_when_root_has_bubbling_click", async () => {
  // 準備
  const { attachFootnotes } = await loadFootnotes();
  const root = createRootFromHtml(await footnoteHtml());
  const hash = location.hash;
  /** まとめた HTML の `view` の `click` と同じく、止められていなければ URL をリンクの `href` へ置き換える */
  const onBubblingClick = (event: MouseEvent): void => {
    const anchor =
      event.target instanceof Element ? event.target.closest("a") : null;
    const href = anchor?.getAttribute("href");
    if (href && !event.defaultPrevented) {
      event.preventDefault();
      history.replaceState(history.state, "", href);
    }
  };
  root.addEventListener("click", onBubblingClick);
  detachers.push(() => {
    root.removeEventListener("click", onBubblingClick);
    history.replaceState(
      history.state,
      "",
      `${location.pathname}${location.search}${hash}`,
    );
  });
  detachers.push(attachFootnotes({ root, placement: "top" }));
  const { link, item } = footnoteParts(root);
  const back = root.querySelector<HTMLElement>(".mdmark-fn-back");
  if (!back) {
    throw new Error("戻るリンクが描かれていない");
  }
  // 実行
  click(link);
  // 検証
  expect(location.hash).toBe(hash);
  expect(document.activeElement).toBe(item);
  // 実行
  click(back);
  // 検証
  expect(location.hash).toBe(hash);
  expect(document.activeElement).toBe(link);
});
