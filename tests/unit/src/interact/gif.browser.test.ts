import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** GIF の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGif = () => import("../../../../src/interact/gif.ts");

const detachers: Array<() => void> = [];

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

/** 1×1 の GIF の data: URL */
const GIF_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** GIF の画像の図を置いた要素を返す */
function createGifRoot(src = GIF_URL): HTMLElement {
  return createRootFromHtml(
    `<figure class="mdmark-figure mdmark-image"><img src="${src}" alt="ビルド" data-gif></figure>`,
  );
}

/** 止める・再生するボタンが付くまで待って返す */
async function waitForToggle(root: ParentNode): Promise<HTMLButtonElement> {
  return vi.waitFor(() => {
    const toggle = root.querySelector<HTMLButtonElement>(
      "button.mdmark-gif-toggle",
    );
    if (!toggle) {
      throw new Error("止める・再生するボタンが無い");
    }
    return toggle;
  });
}

/** `prefers-reduced-motion: reduce` だけに合う `matchMedia` に替える */
function emulateReducedMotion(): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// 包んでボタンで止める・再生する（正常系）
test("test_attach_gifs", async () => {
  // 準備
  const { attachGifs } = await loadGif();
  const root = createGifRoot();
  detachers.push(attachGifs(root));
  const toggle = await waitForToggle(root);
  const wrapper = root.querySelector(".mdmark-gif");
  const img = wrapper?.querySelector("img");
  const canvas = wrapper?.querySelector("canvas");
  // 検証: 包み
  expect(wrapper?.tagName).toBe("SPAN");
  expect(img).not.toBeNull();
  expect(canvas?.hidden).toBe(true);
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  // 実行: 止める
  toggle.click();
  // 検証
  expect(canvas?.hidden).toBe(false);
  expect(img?.style.visibility).toBe("hidden");
  expect(toggle.getAttribute("aria-label")).toBe("GIF を再生");
  // 実行: 再生する
  toggle.click();
  // 検証
  expect(canvas?.hidden).toBe(true);
  expect(img?.style.visibility).not.toBe("hidden");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(toggle.getAttribute("aria-label")).toBe("GIF を停止");
});

// 動きを減らす設定では止めて始める（正常系）
test("test_attach_gifs_when_reduced_motion", async () => {
  // 準備
  emulateReducedMotion();
  const { attachGifs } = await loadGif();
  const root = createGifRoot();
  // 実行
  detachers.push(attachGifs(root));
  // 検証
  const toggle = await waitForToggle(root);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(
    root.querySelector<HTMLCanvasElement>(".mdmark-gif canvas")?.hidden,
  ).toBe(false);
});

// decode に失敗した GIF にはボタンを付けない（異常系）
test("test_attach_gifs_when_decode_failed", async () => {
  // 準備
  const { attachGifs } = await loadGif();
  const root = createGifRoot("data:image/gif;base64,AAAA");
  const img = root.querySelector("img");
  // 実行
  detachers.push(attachGifs(root));
  await img?.decode().catch(() => {});
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // 検証
  expect(root.querySelector(".mdmark-gif")).toBeNull();
  expect(root.querySelector("button.mdmark-gif-toggle")).toBeNull();
});
