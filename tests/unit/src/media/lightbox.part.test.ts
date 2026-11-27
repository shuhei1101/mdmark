import { expect, test } from "vitest";
import {
  findTag,
  findTags,
  innerHtml,
  outerHtml,
  plainText,
} from "../../helpers/html.ts";

/** ライトボックスの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLightbox = () => import("../../../../src/media/lightbox.part.ts");

/** スクリーンリーダー向けの名前が `label` のボタンの開始タグを返却する */
function toolTag(html: string, label: string): string {
  return findTag(html, `aria-label="${label}"`);
}

/** 開始タグが `disabled` を持つか */
function isDisabled(tag: string): boolean {
  return /\sdisabled\b/.test(tag);
}

// 途中の画像は前後に送信でき、枚数を出す（正常系）
test("test_render_lightbox", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の Middle）
  const html = renderLightbox({
    src: "step-2.svg",
    alt: "手順 2 の画面",
    caption: "幅 240px",
    index: 3,
    total: 15,
  });
  // 検証
  expect(
    html.startsWith('<dialog class="mdmark-lightbox" aria-label="画像の拡大">'),
  ).toBe(true);
  expect(isDisabled(toolTag(html, "前の画像"))).toBe(false);
  expect(isDisabled(toolTag(html, "次の画像"))).toBe(false);
  expect(plainText(innerHtml(html, 'class="mdmark-lightbox-count"'))).toBe(
    "3 / 15",
  );
  expect(html).not.toContain('data-group="pan"');
});

// 端の切り替えのボタンを押せなくする（正常系）
test("test_render_lightbox_when_edge", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の First と Last）
  const first = renderLightbox({
    src: "step-1.svg",
    alt: "手順 1 の画面",
    index: 1,
    total: 15,
  });
  const last = renderLightbox({
    src: "step-4.svg",
    alt: "手順 4 の画面",
    index: 15,
    total: 15,
  });
  // 検証
  expect(isDisabled(toolTag(first, "前の画像"))).toBe(true);
  expect(isDisabled(toolTag(first, "次の画像"))).toBe(false);
  expect(isDisabled(toolTag(last, "前の画像"))).toBe(false);
  expect(isDisabled(toolTag(last, "次の画像"))).toBe(true);
});

// 1 枚なら切り替えのボタンと枚数を出さない（正常系）
test("test_render_lightbox_when_single", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の Single）
  const html = renderLightbox({
    src: "step-3.svg",
    alt: "手順 3 の画面",
    caption: "中央に配置した画面",
    index: 1,
    total: 1,
  });
  // 検証
  expect(findTags(html, "mdmark-lightbox-nav")).toHaveLength(0);
});

// 上限の倍率で拡大を押せなくする（正常系）
test("test_render_lightbox_when_max", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の Max）
  const html = renderLightbox({
    src: "step-2.svg",
    alt: "手順 2 の画面",
    index: 3,
    total: 15,
    zoom: 5,
  });
  // 検証
  expect(isDisabled(toolTag(html, "拡大"))).toBe(true);
  expect(plainText(innerHtml(html, 'class="mdmark-lightbox-zoom"'))).toBe(
    "500%",
  );
  expect(html).not.toContain('data-group="pan"');
});

// 上のバーの先頭に隠した移動のボタンを描く（正常系）
test("test_render_lightbox_when_move_button", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  const { iconSvg } = await import("../../../../src/shared/icons.part.ts");
  // 実行
  const html = renderLightbox({
    src: "step-1.svg",
    alt: "手順 1 の画面",
    index: 1,
    total: 1,
  });
  // 検証: 操作のボタンの並びの最初のボタンが移動のボタン
  const tools = outerHtml(html, 'class="mdmark-lightbox-tools"');
  const first = findTags(tools, "<button")[0] ?? "";
  expect(first).toMatch(/class="[^"]*\bmdmark-lightbox-move\b/);
  expect(first).toMatch(/\shidden\b/);
  expect(first).toContain('aria-haspopup="true"');
  expect(first).toContain('aria-expanded="false"');
  expect(first).toContain('aria-label="拡大した画像を移動"');
  expect(first).toContain('title="移動"');
  expect(innerHtml(html, "mdmark-lightbox-move")).toContain(
    iconSvg("move" as never),
  );
});
