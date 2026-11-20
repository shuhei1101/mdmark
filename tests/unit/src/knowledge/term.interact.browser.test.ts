import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 用語のツールチップの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTerms = () => import("../../../../src/knowledge/term.interact.ts");

/** 用語のツールチップの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTermTip = () => import("../../../../src/knowledge/term-tip.part.ts");

const detachers: Array<() => void> = [];

/** 意味だけのツールチップを持つ単語の HTML */
async function termHtml(): Promise<string> {
  const { renderTermTip } = await loadTermTip();
  return renderTermTip({
    text: "ワークスペース",
    id: "tip",
    meaning: "話し合いの記録を配置するフォルダ",
  });
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
  restoreClipboard();
});

// フォーカスで開き Esc で閉じる（正常系）
test("test_attach_term_tips", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await termHtml());
  const wrap = root.querySelector<HTMLElement>(".mdmark-term-wrap");
  const term = root.querySelector<HTMLElement>(".mdmark-term");
  // 実行・検証
  const detach = attachTermTips({ root, placement: "top" });
  expect(wrap?.classList.contains("is-open")).toBe(false);
  term?.focus();
  expect(wrap?.classList.contains("is-open")).toBe(true);
  press("Escape");
  expect(wrap?.classList.contains("is-open")).toBe(false);
  expect(wrap?.classList.contains("is-dismissed")).toBe(true);
  expect(document.activeElement).toBe(term);
  detach();
  for (const name of ["is-open", "is-dismissed", "is-below"]) {
    expect(wrap?.classList.contains(name)).toBe(false);
  }
});

// 同じページに 2 回描いても id が重ならない（正常系）
test("test_attach_term_tips_unique_ids", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const html = await termHtml();
  const roots = [createRootFromHtml(html), createRootFromHtml(html)];
  // 実行
  for (const root of roots) {
    detachers.push(attachTermTips({ root, placement: "top" }));
  }
  // 検証
  const ids = roots.flatMap((root) =>
    [...root.querySelectorAll("[id]")].map((element) => element.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (const root of roots) {
    const term = root.querySelector(".mdmark-term");
    const tip = root.querySelector(".mdmark-term-tip");
    const describedBy = term?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toBe(tip);
  }
});

// 上に収まれば単語の上、収まらなければ単語の下に配置し is-below を付ける（正常系）
test("test_attach_term_tips_when_no_room_above", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const html = await termHtml();
  window.scrollTo(0, 0);
  const topRoot = createRootFromHtml(html);
  const middleRoot = createRootFromHtml(html);
  middleRoot.style.marginTop = `${Math.floor(window.innerHeight / 2)}px`;
  detachers.push(
    attachTermTips({ root: topRoot, placement: "top" }),
    attachTermTips({ root: middleRoot, placement: "top" }),
  );
  const topWrap = topRoot.querySelector<HTMLElement>(".mdmark-term-wrap");
  const topTerm = topRoot.querySelector<HTMLElement>(".mdmark-term");
  const topTip = topRoot.querySelector<HTMLElement>(".mdmark-term-tip");
  const middleWrap = middleRoot.querySelector<HTMLElement>(".mdmark-term-wrap");
  const middleTerm = middleRoot.querySelector<HTMLElement>(".mdmark-term");
  const middleTip = middleRoot.querySelector<HTMLElement>(".mdmark-term-tip");
  if (
    !topWrap ||
    !topTerm ||
    !topTip ||
    !middleWrap ||
    !middleTerm ||
    !middleTip
  ) {
    throw new Error("用語のツールチップが描かれていない");
  }
  // 実行: 画面の中ほどの単語にフォーカスする
  middleTerm.focus();
  // 検証: 単語の上に配置し、is-below を付けない
  expect(middleWrap.classList.contains("is-below")).toBe(false);
  expect(middleTip.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    middleTerm.getBoundingClientRect().top,
  );
  // 実行: 上端の単語にフォーカスする
  topTerm.focus();
  // 検証: 単語の下に配置し、is-below を付ける
  expect(topWrap.classList.contains("is-below")).toBe(true);
  expect(topTip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    topTerm.getBoundingClientRect().bottom,
  );
  // 実行: フォーカスを削除して閉じるのを待つ
  topTerm.blur();
  // 検証: 閉じた後に is-below が残らない
  await vi.waitFor(() => {
    expect(topWrap.classList.contains("is-open")).toBe(false);
  });
  expect(topWrap.classList.contains("is-below")).toBe(false);
});

/** `command` のエイリアスの単語とツールチップの HTML */
async function commandHtml(): Promise<string> {
  const { renderTermTip } = await loadTermTip();
  return renderTermTip({
    text: "単体テスト",
    id: "tip-command",
    alias: {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      description: "ライブラリ本体の単体テストを実行する",
      command: "npm run test:unit",
    },
  });
}

// コピーのボタンでコマンドを記載し、ボタンとスクリーンリーダー向けの要素で通知し、待った後に戻す（正常系）
test("test_attach_term_tips_copy_command", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await commandHtml());
  detachers.push(attachTermTips({ root, placement: "top" }));
  const wrap = root.querySelector<HTMLElement>(".mdmark-term-wrap");
  const button = root.querySelector<HTMLButtonElement>(
    "button.mdmark-term-tip-copy",
  );
  const status = root.querySelector<HTMLElement>('[role="status"]');
  if (!wrap || !button || !status) {
    throw new Error("用語・コピーのボタン・通知の要素が無い");
  }
  // 実行
  root.querySelector<HTMLElement>(".mdmark-term")?.focus();
  button.focus();
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 記載して、コピーしたことをボタンとスクリーンリーダー向けの要素で通知し、ツールチップを開いたままにする
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("npm run test:unit");
  expect(button.dataset.state).toBe("copied");
  expect(button.textContent).toContain("コピーしました");
  expect(status.textContent).toBe("コマンドをコピーしました");
  expect(wrap.classList.contains("is-open")).toBe(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.dataset.state).toBe("idle");
  expect(button.textContent).toContain("コピー");
  expect(button.textContent).not.toContain("コピーしました");
  expect(status.textContent).toBe("");
});

// コマンドを書き込めなければ failed にして残し、例外を外へ出さない（正常系）
test("test_attach_term_tips_copy_command_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await commandHtml());
  detachers.push(attachTermTips({ root, placement: "top" }));
  const button = root.querySelector<HTMLButtonElement>(
    "button.mdmark-term-tip-copy",
  );
  const status = root.querySelector<HTMLElement>('[role="status"]');
  // 実行
  root.querySelector<HTMLElement>(".mdmark-term")?.focus();
  button?.focus();
  button?.click();
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  window.removeEventListener("unhandledrejection", onRejection);
  // 検証: 失敗の通知が 2 秒たっても残り、未処理の例外が無い
  expect(button?.dataset.state).toBe("failed");
  expect(button?.textContent).toContain("コピーできませんでした");
  expect(status?.textContent).toBe("コマンドをコピーできませんでした");
  expect(rejections).toHaveLength(0);
});

/** ポインターの種類を指定したポインターのイベント */
function pointer(type: string, pointerType: string): PointerEvent {
  return new PointerEvent(type, {
    pointerType,
    bubbles: type === "pointerdown" || type === "pointerup",
  });
}

/**
 * 単語へのタッチのタップを、実際の順序（`pointerenter`・`pointerdown`・`pointerup`・`pointerleave` の後にフォーカス）で発生させる。
 * `pointerenter`・`pointerleave` は泡立たないため、ブラウザと同じく単語の枠と単語の両方に送信する。
 * `focus()` は既にフォーカスを持つ単語では `focus` を発火しない
 */
function tap(wrap: HTMLElement, term: HTMLElement): void {
  wrap.dispatchEvent(pointer("pointerenter", "touch"));
  term.dispatchEvent(pointer("pointerenter", "touch"));
  term.dispatchEvent(pointer("pointerdown", "touch"));
  term.dispatchEvent(pointer("pointerup", "touch"));
  term.dispatchEvent(pointer("pointerleave", "touch"));
  wrap.dispatchEvent(pointer("pointerleave", "touch"));
  term.focus();
}

/** 単語の枠と単語を取り出す */
function termParts(root: HTMLElement): {
  wrap: HTMLElement;
  term: HTMLElement;
} {
  const wrap = root.querySelector<HTMLElement>(".mdmark-term-wrap");
  const term = root.querySelector<HTMLElement>(".mdmark-term");
  if (!wrap || !term) {
    throw new Error("用語の単語が描かれていない");
  }
  return { wrap, term };
}

// タッチの 1 回のタップで開き、もう一度のタップで閉じる（正常系）
test("test_attach_term_tips_when_touch_tapped", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await termHtml());
  detachers.push(attachTermTips({ root, placement: "top" }));
  const { wrap, term } = termParts(root);
  // 実行
  tap(wrap, term);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(wrap.classList.contains("is-open")).toBe(true);
  // 実行
  tap(wrap, term);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(wrap.classList.contains("is-open")).toBe(false);
});

// タッチで開いた後、外の pointerdown だけで閉じ、ツールチップの中では閉じない（正常系）
test("test_attach_term_tips_when_touch_outside", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await commandHtml());
  detachers.push(attachTermTips({ root, placement: "top" }));
  const { wrap, term } = termParts(root);
  const button = root.querySelector<HTMLElement>("button.mdmark-term-tip-copy");
  const outside = document.createElement("p");
  document.body.append(outside);
  detachers.push(() => outside.remove());
  tap(wrap, term);
  // 実行: ツールチップの中のコピーのボタン
  button?.dispatchEvent(pointer("pointerdown", "touch"));
  vi.advanceTimersByTime(1000);
  // 検証
  expect(wrap.classList.contains("is-open")).toBe(true);
  // 実行: root の外（pointerleave・focusout は送信しない）
  outside.dispatchEvent(pointer("pointerdown", "touch"));
  vi.advanceTimersByTime(1000);
  // 検証: 単語にフォーカスが残ったままでも、ツールチップを出さない
  expect(wrap.classList.contains("is-open")).toBe(false);
  expect(wrap.classList.contains("is-dismissed")).toBe(true);
  expect(document.activeElement).toBe(term);
  const tip = wrap.querySelector<HTMLElement>(".mdmark-term-tip");
  expect(tip && getComputedStyle(tip).display).toBe("none");
});

// ツールチップの中のボタンにフォーカスがある状態で単語をタップすると、閉じたままになる（正常系）
test("test_attach_term_tips_when_touch_tapped_after_button_focus", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await commandHtml());
  detachers.push(attachTermTips({ root, placement: "top" }));
  const { wrap, term } = termParts(root);
  const button = root.querySelector<HTMLElement>("button.mdmark-term-tip-copy");
  tap(wrap, term);
  button?.dispatchEvent(pointer("pointerdown", "touch"));
  button?.focus();
  // 実行: 単語の focusin が pointerdown の後に発火する
  tap(wrap, term);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(document.activeElement).toBe(term);
  expect(wrap.classList.contains("is-open")).toBe(false);
  // 実行
  tap(wrap, term);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(wrap.classList.contains("is-open")).toBe(true);
});

// マウスの pointerdown では開閉を切り替えない（正常系）
test("test_attach_term_tips_when_mouse_pressed", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await termHtml());
  detachers.push(attachTermTips({ root, placement: "top" }));
  const { wrap, term } = termParts(root);
  wrap.dispatchEvent(pointer("pointerenter", "mouse"));
  // 実行
  term.dispatchEvent(pointer("pointerdown", "mouse"));
  // 検証
  expect(wrap.classList.contains("is-open")).toBe(true);
});

/** 先頭の列をピン止めした表の HTML。見出しの行を高くし、本文の 1 行目のセルの上に開いたツールチップが見出し行と重なるようにする */
function pinnedTableHtml(options: {
  headFirst?: string;
  headSecond?: string;
  bodyFirst?: string;
}): string {
  const {
    headFirst = "用語",
    headSecond = "説明",
    bodyFirst = "項目",
  } = options;
  return `<div class="mdmark-table"><table><thead><tr><th class="is-pinned-col" style="left: 0; height: 240px">${headFirst}</th><th style="height: 240px">${headSecond}</th></tr></thead><tbody><tr><td class="is-pinned-col" style="left: 0">${bodyFirst}</td><td>説明の文</td></tr></tbody></table></div>`;
}

/** 要素の中の点 (x, y) で一番手前に描かれる要素が、`container` の中にあるか */
function frontmostWithin(container: Element, x: number, y: number): boolean {
  const hit = document.elementFromPoint(x, y);
  return hit !== null && container.contains(hit);
}

// ピン止めした列のセルの中のツールチップを、上に開いたときに留めた見出し行より手前に描く（正常系）
test("test_attach_term_tips_when_in_pinned_cell", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  window.scrollTo(0, 0);
  const root = createRootFromHtml(
    pinnedTableHtml({ bodyFirst: await termHtml() }),
  );
  root.style.marginTop = `${Math.floor(window.innerHeight / 2)}px`;
  detachers.push(attachTermTips({ root, placement: "top" }));
  const { wrap, term } = termParts(root);
  const cell = wrap.closest("td");
  const tip = wrap.querySelector<HTMLElement>(".mdmark-term-tip");
  if (!cell || !tip) {
    throw new Error("ピン止めした列のセルかツールチップが無い");
  }
  // 実行: 単語にフォーカスして上に開く
  term.focus();
  // 検証: セルが is-tip-open を持ち、ツールチップの上端の点で一番手前にツールチップが描かれる
  expect(wrap.classList.contains("is-below")).toBe(false);
  expect(cell.classList.contains("is-tip-open")).toBe(true);
  const rect = tip.getBoundingClientRect();
  expect(frontmostWithin(tip, rect.left + 10, rect.top + 10)).toBe(true);
  // 実行: Esc で閉じる
  press("Escape");
  // 検証
  expect(cell.classList.contains("is-tip-open")).toBe(false);
});

// 見出し行のセルの中のツールチップを開いている間、セルを見出し行・ピン止めした列の見出しより手前に出す（正常系）
test("test_attach_term_tips_when_in_sticky_head_cell", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const { renderTermTip } = await loadTermTip();
  const tipHtml = (id: string) =>
    renderTermTip({
      text: "ワークスペース",
      id,
      meaning: "話し合いの記録を配置するフォルダ",
    });
  const root = createRootFromHtml(
    pinnedTableHtml({
      headFirst: tipHtml("tip-head-pinned"),
      headSecond: tipHtml("tip-head"),
    }),
  );
  detachers.push(attachTermTips({ root, placement: "top" }));
  const heads = [...root.querySelectorAll<HTMLElement>("thead th")];
  for (const head of heads) {
    const term = head.querySelector<HTMLElement>(".mdmark-term");
    if (!term) {
      throw new Error("見出しのセルに用語の単語が無い");
    }
    // 実行: 見出しのセルの単語にフォーカスして開く
    term.focus();
    // 検証: 開いている間、見出しのセルが is-tip-open を持ち、z-index が 10 になる
    expect(head.classList.contains("is-tip-open")).toBe(true);
    expect(getComputedStyle(head).zIndex).toBe("10");
    press("Escape");
  }
});

// 同じセルの脚注のツールチップが開いていれば、用語が閉じてもセルの is-tip-open を残す（正常系）
test("test_attach_term_tips_when_footnote_open_in_same_cell", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachTermTips } = await loadTerms();
  const { attachFootnotes } = await import(
    "../../../../src/footnote/footnote.interact.ts"
  );
  const { renderFootnoteRef } = await import(
    "../../../../src/footnote/footnote.part.ts"
  );
  const ref = renderFootnoteRef({ number: 1, bodies: ["補足の中身。"] });
  const root = createRootFromHtml(
    pinnedTableHtml({ bodyFirst: `${await termHtml()}${ref}` }),
  );
  detachers.push(
    attachTermTips({ root, placement: "top" }),
    attachFootnotes({ root, placement: "top" }),
  );
  const { wrap } = termParts(root);
  const sup = root.querySelector<HTMLElement>("sup.mdmark-fn-ref");
  const cell = wrap.closest("td");
  if (!sup || !cell) {
    throw new Error("脚注の番号かセルが無い");
  }
  // 実行: 用語を開き、同じセルの脚注の番号へ移る
  wrap.dispatchEvent(pointer("pointerenter", "mouse"));
  wrap.dispatchEvent(pointer("pointerleave", "mouse"));
  sup.dispatchEvent(pointer("pointerenter", "mouse"));
  vi.advanceTimersByTime(150);
  // 検証
  expect(wrap.classList.contains("is-open")).toBe(false);
  expect(sup.classList.contains("is-open")).toBe(true);
  expect(cell.classList.contains("is-tip-open")).toBe(true);
});
