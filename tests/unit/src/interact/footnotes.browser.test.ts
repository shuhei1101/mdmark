import { afterEach, beforeAll, expect, test } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 脚注の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFootnotes = () => import("../../../../src/interact/footnotes.ts");

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
});

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
