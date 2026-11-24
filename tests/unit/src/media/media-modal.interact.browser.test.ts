import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 再生のダイアログの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMediaModal = () =>
  import("../../../../src/media/media-modal.interact.ts");

const detachers: Array<() => void> = [];

/** `play`・`pause` の呼び出しの記録 */
const calls = { play: 0, pause: 0 };

beforeAll(() => {
  addStyles();
});

beforeEach(() => {
  calls.play = 0;
  calls.pause = 0;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
    calls.play += 1;
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
    calls.pause += 1;
  });
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** `render` が出す再生のボタン */
function openerHtml(src: string, label: string): string {
  return `<button class="mdmark-media-open" type="button" aria-haspopup="dialog" data-media-kind="video" data-media-src="${src}"><span class="mdmark-media-open-label">${label}</span></button>`;
}

/** 再生のボタン 2 つを描いた要素に操作を付けて返却する */
async function setup(): Promise<{
  root: HTMLElement;
  buttons: HTMLButtonElement[];
  detach: () => void;
}> {
  const { attachMediaModal } = await loadMediaModal();
  const root = createRootFromHtml(
    `<p>${openerHtml("m1.mp4", "素材 1")}</p><p>${openerHtml("m2.mp4", "素材 2")}</p>`,
  );
  const detach = attachMediaModal(root);
  detachers.push(detach);
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>("button.mdmark-media-open"),
  ];
  return { root, buttons, detach };
}

/** 開いている再生のダイアログを返却する */
function openDialog(root: ParentNode): HTMLDialogElement {
  const dialog = root.querySelector<HTMLDialogElement>(
    "dialog.mdmark-media-modal[open]",
  );
  if (!dialog) {
    throw new Error("開いた再生のダイアログが無い");
  }
  return dialog;
}

// ボタンで開いて再生し、Esc で閉じて止める（正常系）
test("test_attach_media_modal", async () => {
  // 準備
  const { root, buttons } = await setup();
  const scrollY = window.scrollY;
  // 実行
  await userEvent.click(buttons[0]);
  const dialog = openDialog(root);
  const playedAfterOpen = calls.play;
  await userEvent.keyboard("{Escape}");
  // 検証
  expect(dialog.querySelector("video")?.getAttribute("src")).toBe("m1.mp4");
  expect(playedAfterOpen).toBe(1);
  expect(root.querySelector("dialog.mdmark-media-modal")).toBeNull();
  expect(calls.pause).toBe(1);
  expect(document.activeElement).toBe(buttons[0]);
  expect(window.scrollY).toBe(scrollY);
});

// 閉じるボタンと背景で閉じる（正常系）
test("test_attach_media_modal_when_closed", async () => {
  // 準備
  const { root, buttons } = await setup();
  // 実行（閉じるボタン）
  await userEvent.click(buttons[0]);
  const closeButton = openDialog(root).querySelector<HTMLButtonElement>(
    'button[data-tool="close"]',
  );
  if (!closeButton) {
    throw new Error("閉じるボタンが無い");
  }
  await userEvent.click(closeButton);
  // 検証
  expect(root.querySelector("dialog.mdmark-media-modal")).toBeNull();
  expect(document.activeElement).toBe(buttons[0]);
  // 実行（dialog 自身を押す）
  await userEvent.click(buttons[1]);
  const dialog = openDialog(root);
  dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  dialog.close();
  // 検証
  expect(root.querySelector("dialog.mdmark-media-modal")).toBeNull();
  expect(document.activeElement).toBe(buttons[1]);
});

// 矢印キーで切り替えない（正常系）
test("test_attach_media_modal_when_arrow", async () => {
  // 準備
  const { root, buttons } = await setup();
  // 実行
  await userEvent.click(buttons[0]);
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  const dialogs = root.querySelectorAll("dialog.mdmark-media-modal");
  expect(dialogs).toHaveLength(1);
  expect(openDialog(root).querySelector("video")?.getAttribute("src")).toBe(
    "m1.mp4",
  );
});

// 削除すると開いたダイアログを閉じ、押しても開かない（正常系）
test("test_attach_media_modal_when_cleaned_up", async () => {
  // 準備
  const { root, buttons, detach } = await setup();
  await userEvent.click(buttons[0]);
  openDialog(root);
  // 実行
  detach();
  await userEvent.click(buttons[0]);
  // 検証
  expect(root.querySelector("dialog.mdmark-media-modal")).toBeNull();
});
