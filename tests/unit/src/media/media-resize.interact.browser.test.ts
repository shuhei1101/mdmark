import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { memoryStorage } from "../../helpers/storage.ts";

/** 動画のリサイズハンドルの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadResize = () =>
  import("../../../../src/media/media-resize.interact.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  for (const menu of document.querySelectorAll(".mdmark-media-size-menu")) {
    menu.remove();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 幅を保つキー */
const KEY = "mdmark-media-width:/a.html#0:clip.mp4";

/** 本文の幅 */
const MAX_WIDTH = 800;

/** 動画の図の HTML（幅は `--mdmark-image-width`、無ければ本文の幅） */
const figureHtml = (options: { label: string; src: string; style?: string }) =>
  `<figure class="mdmark-figure mdmark-media" style="margin: 0;${options.style === undefined ? "" : ` ${options.style}`}"><video src="${options.src}" controls preload="metadata" aria-label="${options.label}" style="display: block; width: var(--mdmark-image-width, 100%)"></video></figure>`;

/** 動画の縦横の大きさを 1100×720 にする */
function setVideoSize(video: HTMLVideoElement): void {
  Object.defineProperty(video, "videoWidth", { value: 1100 });
  Object.defineProperty(video, "videoHeight", { value: 720 });
}

/** 幅 800px の本文に動画の図・リサイズハンドル・大きさのメニューを配置し、操作を付ける */
async function setUp(
  storage: Storage | null,
  figureStyle?: string,
): Promise<{
  figure: HTMLElement;
  handle: HTMLButtonElement;
  menu: HTMLElement;
  restored: number | null;
}> {
  const { attachMediaResize } = await loadResize();
  const root = createRootFromHtml(
    `${figureHtml({ label: "素材の確認", src: "clip.mp4", ...(figureStyle === undefined ? {} : { style: figureStyle }) })}<button type="button" class="mdmark-media-resize" popovertarget="size-menu">ハンドル</button><div id="size-menu" class="mdmark-media-size-menu" popover="auto"><button type="button" data-size="smaller">小さくする</button><button type="button" data-size="larger">大きくする</button><button type="button" data-size="reset">元の大きさに戻す</button></div>`,
  );
  root.style.width = `${MAX_WIDTH}px`;
  const figure = root.querySelector<HTMLElement>("figure");
  const video = root.querySelector<HTMLVideoElement>("video");
  const handle = root.querySelector<HTMLButtonElement>(".mdmark-media-resize");
  const menu = root.querySelector<HTMLElement>(".mdmark-media-size-menu");
  if (!figure || !video || !handle || !menu) {
    throw new Error("動画の図・ハンドル・メニューが無い");
  }
  setVideoSize(video);
  const result = attachMediaResize({
    figure,
    video,
    handle,
    menu,
    key: KEY,
    storage,
    maxWidth: () => MAX_WIDTH,
  });
  detachers.push(result.detach);
  return { figure, handle, menu, restored: result.restored };
}

/** ハンドルを `dx`・`dy` px だけドラッグする */
function drag(handle: HTMLElement, dx: number, dy = 0): void {
  const point = { bubbles: true, pointerId: 1, button: 0 };
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientX: 100, clientY: 100 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", {
      ...point,
      clientX: 100 + dx,
      clientY: 100 + dy,
    }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", {
      ...point,
      clientX: 100 + dx,
      clientY: 100 + dy,
    }),
  );
}

/** 図の `--mdmark-image-width` の値 */
const widthOf = (figure: HTMLElement): string =>
  figure.style.getPropertyValue("--mdmark-image-width");

// 再生バーを持つ動画だけにハンドルとメニューを配置し、削除で元に戻す（正常系）
test("test_attach_media_resizes", async () => {
  // 準備
  const { attachMediaResizes } = await loadResize();
  const root = createRootFromHtml(
    [
      figureHtml({ label: "素材の確認", src: "clip.mp4" }),
      figureHtml({ label: "", src: "clips/demo.mp4?v=1" }),
      '<figure class="mdmark-figure mdmark-media"><audio src="voice.mp3" controls aria-label="読み上げ"></audio></figure>',
      '<p><button class="mdmark-media-open" type="button" aria-haspopup="dialog" data-media-kind="video" data-media-src="save.mp4"><span class="mdmark-media-open-label">保存</span></button></p>',
    ].join(""),
  );
  // 実行
  const detach = attachMediaResizes({ root, storage: null });
  // 検証
  const handles = root.querySelectorAll<HTMLButtonElement>(
    "button.mdmark-media-resize",
  );
  expect(handles).toHaveLength(2);
  expect(root.querySelectorAll("div.mdmark-media-frame")).toHaveLength(2);
  expect(root.querySelectorAll(".mdmark-media-size-menu")).toHaveLength(2);
  expect(handles[0]?.getAttribute("aria-label")).toBe(
    "「素材の確認」の大きさを変える",
  );
  expect(handles[1]?.getAttribute("aria-label")).toBe(
    "「demo.mp4」の大きさを変える",
  );
  expect(
    root.querySelector("figure:has(audio) .mdmark-media-resize"),
  ).toBeNull();
  // 実行
  detach();
  // 検証
  expect(root.querySelectorAll(".mdmark-media-frame")).toHaveLength(0);
  expect(root.querySelectorAll(".mdmark-media-resize")).toHaveLength(0);
  expect(root.querySelectorAll(".mdmark-media-size-menu")).toHaveLength(0);
  expect(root.querySelectorAll("figure > video")).toHaveLength(2);
});

// ドラッグと上下キーで縦横の比を保って幅を変えて保つ（正常系）
test("test_attach_media_resize", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const storage = memoryStorage();
  const { figure, handle } = await setUp(storage);
  // 実行: 200px 左へドラッグする
  drag(handle, -200);
  // 検証
  expect(widthOf(figure)).toBe("600px");
  // 実行: ↓ を押す
  handle.focus();
  await userEvent.keyboard("{ArrowDown}");
  // 検証: 600 + 32 × 1100 ÷ 720 を丸めた値
  expect(widthOf(figure)).toBe("649px");
  expect(storage.getItem(KEY)).toBe("649");
});

// 動かさずに押すとメニューを開き、ドラッグした後は開かない（正常系）
test("test_attach_media_resize_when_click_without_drag", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { figure, handle, menu } = await setUp(memoryStorage());
  // 実行: 3px だけ動かして離す
  drag(handle, 3);
  handle.click();
  // 検証（メニューの toggle のイベントは開いた後に届くため、届くまで待つ）
  expect(widthOf(figure)).toBe("");
  expect(menu.matches(":popover-open")).toBe(true);
  await vi.waitFor(() => {
    expect(document.activeElement?.getAttribute("data-size")).toBe("smaller");
  });
  expect(
    menu.querySelector<HTMLButtonElement>('[data-size="reset"]')?.disabled,
  ).toBe(true);
  // 準備: メニューを閉じる
  menu.hidePopover();
  // 実行: 100px 動かして離す
  drag(handle, -100);
  handle.click();
  // 検証
  expect(widthOf(figure)).toBe("700px");
  expect(menu.matches(":popover-open")).toBe(false);
});

// ダブルクリックで記載した幅に戻し、キーを削除する（正常系）
test("test_attach_media_resize_when_reset", async () => {
  // 準備
  const storage = memoryStorage({ [KEY]: "300" });
  const { figure, handle } = await setUp(storage, "--mdmark-image-width: 50%");
  expect(widthOf(figure)).toBe("300px");
  // 実行
  handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  // 検証
  expect(widthOf(figure)).toBe("50%");
  expect(storage.getItem(KEY)).toBeNull();
});

// 保った幅で開き、読み込めない値は使用しない（正常系）
test("test_attach_media_resize_when_restored", async () => {
  // 実行: 保った幅が 420
  const kept = await setUp(memoryStorage({ [KEY]: "420" }));
  // 検証
  expect(kept.restored).toBe(420);
  expect(widthOf(kept.figure)).toBe("420px");
  // 準備: 前の図を片付ける
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  // 実行: 保った値が読み込めない
  const unreadable = await setUp(memoryStorage({ [KEY]: "abc" }));
  // 検証
  expect(unreadable.restored).toBeNull();
  expect(widthOf(unreadable.figure)).toBe("");
});

// 下限と本文の幅に収める（正常系）
test("test_clamp_media_width", async () => {
  // 準備
  const { clampMediaWidth } = await loadResize();
  // 実行・検証
  expect(clampMediaWidth({ width: 100, maxWidth: 800 })).toBe(160);
  expect(clampMediaWidth({ width: 900.4, maxWidth: 800 })).toBe(800);
  expect(clampMediaWidth({ width: 412.6, maxWidth: 800 })).toBe(413);
  expect(clampMediaWidth({ width: 200, maxWidth: 120 })).toBe(120);
});

// ページ・順・src でキーを作る（正常系）
test("test_media_width_key", async () => {
  // 準備
  const { mediaWidthKey } = await loadResize();
  // 実行
  const key = mediaWidthKey({
    pathname: "/docs/a.html",
    index: 1,
    src: "clip.mp4",
  });
  // 検証
  expect(key).toBe("mdmark-media-width:/docs/a.html#1:clip.mp4");
});
