import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 用語のツールチップの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTerms = () => import("../../../../src/interact/terms.ts");

/** 用語のツールチップの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTermTip = () => import("../../../../src/parts/term-tip.ts");

const detachers: Array<() => void> = [];

/** 意味だけのツールチップを持つ語の HTML */
async function termHtml(): Promise<string> {
  const { renderTermTip } = await loadTermTip();
  return renderTermTip({
    text: "ワークスペース",
    id: "tip",
    meaning: "話し合いの記録を置くフォルダ",
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

// 上に収まれば語の上、収まらなければ語の下に置き is-below を付ける（正常系）
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
  // 実行: 画面の中ほどの語にフォーカスする
  middleTerm.focus();
  // 検証: 語の上に置き、is-below を付けない
  expect(middleWrap.classList.contains("is-below")).toBe(false);
  expect(middleTip.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    middleTerm.getBoundingClientRect().top,
  );
  // 実行: 上端の語にフォーカスする
  topTerm.focus();
  // 検証: 語の下に置き、is-below を付ける
  expect(topWrap.classList.contains("is-below")).toBe(true);
  expect(topTip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    topTerm.getBoundingClientRect().bottom,
  );
  // 実行: フォーカスを外して閉じるのを待つ
  topTerm.blur();
  // 検証: 閉じた後に is-below が残らない
  await vi.waitFor(() => {
    expect(topWrap.classList.contains("is-open")).toBe(false);
  });
  expect(topWrap.classList.contains("is-below")).toBe(false);
});

/** `command` のエイリアスの語とツールチップの HTML */
async function commandHtml(): Promise<string> {
  const { renderTermTip } = await loadTermTip();
  return renderTermTip({
    text: "単体テスト",
    id: "tip-command",
    alias: {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      description: "ライブラリ本体の単体テストを流す",
      command: "npm run test:unit",
    },
  });
}

// コピーのボタンでコマンドを書き、ボタンと読み上げの要素で知らせ、待った後に戻す（正常系）
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
  // 実行
  root.querySelector<HTMLElement>(".mdmark-term")?.focus();
  button?.focus();
  button?.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 書いて、コピーしたことをボタンと読み上げの要素で知らせ、ツールチップを開いたままにする
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("npm run test:unit");
  expect(button?.dataset.state).toBe("copied");
  expect(button?.textContent).toContain("コピーしました");
  expect(status?.textContent).toBe("コマンドをコピーしました");
  expect(wrap?.classList.contains("is-open")).toBe(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(button?.dataset.state).toBe("idle");
  expect(button?.textContent).toContain("コピー");
  expect(button?.textContent).not.toContain("コピーしました");
  expect(status?.textContent).toBe("");
});

// コマンドを書けなければ failed にして残し、例外を外へ出さない（正常系）
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
  // 検証: 失敗の知らせが 2 秒たっても残り、未処理の例外が無い
  expect(button?.dataset.state).toBe("failed");
  expect(button?.textContent).toContain("コピーできませんでした");
  expect(status?.textContent).toBe("コマンドをコピーできませんでした");
  expect(rejections).toHaveLength(0);
});
