import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { MdmarkParamDefinition } from "../../../../src/diagram/definition.ts";
import {
  parsed,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../helpers/diagrams.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 操作できる部品の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParams = () => import("../../../../src/interact/params.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 見本の操作できる部品を描いた要素と、その定義 */
function createParamRoot(): {
  root: HTMLElement;
  definitions: MdmarkParamDefinition[];
} {
  const { root } = createRoot(wrapDirective("param", STRENGTH_TEXT));
  return { root, definitions: [parsed<MdmarkParamDefinition>(STRENGTH_TEXT)] };
}

/** スライダーを値にして `input` を送る */
function setSlider(root: HTMLElement, value: number): void {
  const slider = root.querySelector<HTMLInputElement>('input[type="range"]');
  if (!slider) {
    throw new Error("スライダーが無い");
  }
  slider.value = String(value);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 今の値を写すボタンを押す */
async function copy(root: HTMLElement): Promise<void> {
  const copyButton = [...root.querySelectorAll("button")].find(
    (candidate) =>
      candidate.getAttribute("aria-label")?.includes("写す") ||
      candidate.textContent?.includes("写す"),
  );
  if (!copyButton) {
    throw new Error("今の値を写すボタンが無い");
  }
  copyButton.click();
  await Promise.resolve();
}

// 値を変えて写す（正常系）
test("test_attach_params", async () => {
  // 準備
  const { attachParams } = await loadParams();
  const { root, definitions } = createParamRoot();
  const written: string[] = [];
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
    async (text) => {
      written.push(text);
    },
  );
  detachers.push(attachParams(root, definitions));
  // 実行
  setSlider(root, 8);
  await copy(root);
  // 検証
  await vi.waitFor(() => {
    expect(root.textContent).toContain("クリップボードに写しました");
  });
  expect(root.querySelector("output")?.textContent).toBe("8");
  expect(JSON.parse(written[0] ?? "{}").strength.value).toBe(8);
});

// 拒まれたら、選んで写せる JSON を出す（異常系）
test("test_attach_params_when_clipboard_denied", async () => {
  // 準備
  const { attachParams } = await loadParams();
  const { root, definitions } = createParamRoot();
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
    new DOMException("denied", "NotAllowedError"),
  );
  detachers.push(attachParams(root, definitions));
  setSlider(root, 8);
  // 実行
  await copy(root);
  // 検証
  await vi.waitFor(() => {
    const fallback = root.querySelector<HTMLElement>("pre");
    expect(fallback).not.toBeNull();
    expect(fallback?.hidden).toBe(false);
  });
  const text = root.querySelector("pre")?.textContent ?? "";
  expect(JSON.parse(text).strength.value).toBe(8);
});
