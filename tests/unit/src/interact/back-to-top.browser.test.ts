import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { addStyles } from "../../helpers/dom.ts";

/** 先頭へ戻るボタンの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBackToTop = () => import("../../../../src/interact/back-to-top.ts");

/** 画面の幅と高さ */
const VIEWPORT = { width: 1280, height: 800 };

/** 描いた文書の高さ（画面の高さより十分に長い） */
const DOCUMENT_HEIGHT = 3000;

/** 置き直しの基準の位置（スクロールする場所の端からの距離が 0 のとき） */
const BASE_POSITION = "calc(0px + var(--mdmark-back-to-top-gap))";

const originalMatchMedia = window.matchMedia;
const originalBodyMargin = document.body.style.margin;
const elements: HTMLElement[] = [];
const detachers: Array<() => void> = [];

/** 高さ DOCUMENT_HEIGHT の段落を持つ、描く先の要素をページの先頭に置く */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "mdmark";
  const paragraph = document.createElement("p");
  paragraph.style.height = `${DOCUMENT_HEIGHT}px`;
  paragraph.style.margin = "0";
  el.append(paragraph);
  document.body.prepend(el);
  elements.push(el);
  return el;
}

/** 描く先の要素に先頭へ戻るボタンを付け、後始末のために外す関数を控える */
async function attach(el: HTMLElement, content: HTMLElement = el) {
  const { attachBackToTop } = await loadBackToTop();
  const detach = attachBackToTop({ el, content });
  detachers.push(detach);
  return detach;
}

/** 描く先の要素の中のボタンを返す（無ければ例外） */
function findButton(el: HTMLElement): HTMLButtonElement {
  const button = el.querySelector<HTMLButtonElement>(
    ":scope > button.mdmark-back-to-top",
  );
  if (!button) {
    throw new Error("先頭へ戻るボタンが無い");
  }
  return button;
}

/** 次の 2 フレームを待つ（スクロールの受け取りと、予約した置き直しのフレーム） */
async function nextFrames(): Promise<void> {
  for (let count = 0; count < 2; count += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** ページを指定の量までスクロールし、置き直しを待つ */
async function scrollPage(top: number): Promise<void> {
  document.documentElement.scrollTop = top;
  window.dispatchEvent(new Event("scroll"));
  await nextFrames();
}

/** 部品の左端から、ボタンをずらした先の右の位置（画面の右端からの px）を返す */
function avoidedRight(obstacle: HTMLElement): string {
  const { left } = obstacle.getBoundingClientRect();
  return `${document.documentElement.clientWidth - left + 8}px`;
}

/** `matchMedia` を、動きを減らす設定に当たるかを決めた偽物に替える */
function fakeReducedMotion(reduce: boolean): void {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

beforeEach(async () => {
  // ボタンの `position: fixed` と大きさは mdmark の CSS で決まる
  addStyles();
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  document.body.style.margin = "0";
});

afterEach(() => {
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  for (const detach of detachers.splice(0)) {
    detach();
  }
  for (const element of elements.splice(0)) {
    element.remove();
  }
  for (const band of document.querySelectorAll(".mdmark-diff-minimap")) {
    band.remove();
  }
  document.documentElement.scrollTop = 0;
  document.body.style.margin = originalBodyMargin;
});

// 画面の高さ分スクロールするまで隠し、届いたら右下に出す（正常系）
test("test_attach_back_to_top", async () => {
  // 準備
  const el = createElement();
  await attach(el);
  const button = findButton(el);
  // 実行
  await scrollPage(VIEWPORT.height - 1);
  const hiddenBefore = button.hidden;
  await scrollPage(VIEWPORT.height);
  // 検証
  expect(hiddenBefore).toBe(true);
  expect(button.hidden).toBe(false);
  expect(button.style.getPropertyValue("--mdmark-back-to-top-right")).toBe(
    BASE_POSITION,
  );
  expect(button.style.getPropertyValue("--mdmark-back-to-top-bottom")).toBe(
    BASE_POSITION,
  );
});

// 余白の列と横の範囲が重なれば、その左から間を空けて置く（正常系）
test("test_attach_back_to_top_when_obstacle", async () => {
  // 準備
  const el = createElement();
  el.style.position = "relative";
  const margin = document.createElement("div");
  margin.className = "mdmark-comment-margin";
  margin.style.position = "absolute";
  margin.style.top = "0";
  margin.style.right = "0";
  margin.style.width = "40px";
  margin.style.height = "100%";
  el.append(margin);
  await attach(el);
  // 実行
  await scrollPage(VIEWPORT.height);
  // 検証
  expect(
    findButton(el).style.getPropertyValue("--mdmark-back-to-top-right"),
  ).toBe(avoidedRight(margin));
});

// ミニマップの帯が後から配置されると、スクロールせずに帯の左へずらす（正常系）
test("test_attach_back_to_top_when_minimap_added", async () => {
  // 準備
  const el = createElement();
  await attach(el);
  await scrollPage(VIEWPORT.height);
  const band = document.createElement("div");
  band.className = "mdmark-diff-minimap";
  band.style.position = "fixed";
  band.style.top = "0";
  band.style.right = "0";
  band.style.width = "12px";
  band.style.height = "100vh";
  // 実行
  document.body.append(band);
  await nextFrames();
  // 検証
  expect(
    findButton(el).style.getPropertyValue("--mdmark-back-to-top-right"),
  ).toBe(avoidedRight(band));
});

// 押すと先頭へスクロールして本文の列へフォーカスを移す（正常系）
test("test_attach_back_to_top_when_pressed", async () => {
  // 準備
  const el = createElement();
  const content = document.createElement("div");
  el.prepend(content);
  await attach(el, content);
  await scrollPage(VIEWPORT.height);
  const expectedTop = window.scrollY + el.getBoundingClientRect().top;
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  // 実行
  fakeReducedMotion(true);
  findButton(el).click();
  fakeReducedMotion(false);
  findButton(el).click();
  // 検証
  const calls = scrollTo.mock.calls.map(
    (call) => call[0] as unknown as ScrollToOptions,
  );
  expect(calls).toEqual([
    { top: expectedTop, behavior: "auto" },
    { top: expectedTop, behavior: "smooth" },
  ]);
  expect(content.getAttribute("tabindex")).toBe("-1");
  expect(document.activeElement).toBe(content);
});

// 外す関数でボタンと受け取りを外す（正常系）
test("test_attach_back_to_top_when_detached", async () => {
  // 準備
  const el = createElement();
  const content = document.createElement("div");
  el.prepend(content);
  const detach = await attach(el, content);
  await scrollPage(VIEWPORT.height);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  findButton(el).click();
  // 実行
  detach();
  // 検証
  await expect(scrollPage(VIEWPORT.height + 100)).resolves.toBeUndefined();
  expect(el.querySelector("button.mdmark-back-to-top")).toBeNull();
  expect(content.hasAttribute("tabindex")).toBe(false);
});
