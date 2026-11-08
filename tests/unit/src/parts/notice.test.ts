import { expect, test } from "vitest";

/** 通知ブロックの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadNotice = () => import("../../../../src/parts/notice.ts");

/** 通知ブロックの HTML を、タイトルとマーカーの名前（エスケープ済み）から組み立てる */
function expectedNotice(title: string, escapedName: string): string {
  return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>表示に使用するライブラリ（<code>${escapedName}</code>）を読み込めませんでした。ネットワークにつながっているかを確認して、ページを再読み込みしてください。</p></div>`;
}

// 図のマーカーのタイトルと、マーカーの名前を入れた本文を返却する（正常系）
test("test_render_notice", async () => {
  // 準備
  const { renderNotice } = await loadNotice();
  // 実行
  const html = renderNotice({ name: "chart" });
  // 検証
  expect(html).toBe(expectedNotice("この図を表示できません", "chart"));
});

// 図でないマーカーのタイトルを返却する（正常系）
test("test_render_notice_when_block", async () => {
  // 準備
  const { renderNotice } = await loadNotice();
  // 実行
  const html = renderNotice({ name: "tabs", figure: false });
  // 検証
  expect(html).toBe(expectedNotice("この箇所を表示できません", "tabs"));
});

// 拡張を読み込めないときの本文を返却する（正常系）
test("test_render_notice_when_extension", async () => {
  // 準備
  const { renderNotice } = await loadNotice();
  // 実行
  const html = renderNotice({ name: "greet", source: "extension" });
  // 検証
  expect(html).toContain(
    "<p>表示に使用する拡張（<code>greet</code>）を読み込めませんでした。",
  );
});

// 差分の取り出し元を読み込めないときのタイトルと本文を返却する（正常系）
test("test_render_notice_when_diff", async () => {
  // 準備
  const { renderNotice } = await loadNotice();
  // 実行
  const revisions = renderNotice({ name: "guide", source: "diff-revisions" });
  const content = renderNotice({
    name: "2026/10/19 16:40 件数を修正する",
    source: "diff-content",
  });
  // 検証
  expect(revisions).toContain(
    '<strong class="mdmark-notice-title">変更の履歴を表示できません</strong>',
  );
  expect(content).toContain(
    "<p>「2026/10/19 16:40 件数を修正する」の本文を取り出せませんでした。",
  );
});

// 部品のモジュールを読み込めないときの本文を返却する（正常系）
test("test_render_notice_when_part", async () => {
  // 準備
  const { renderNotice } = await loadNotice();
  // 実行
  const html = renderNotice({ name: "view", figure: false, source: "part" });
  // 検証
  expect(html).toContain(
    '<strong class="mdmark-notice-title">この箇所を表示できません</strong>',
  );
  expect(html).toContain(
    "<p>表示に使用する部品（<code>view</code>）を読み込めませんでした。",
  );
});

// マーカーの名前をエスケープする（正常系）
test("test_render_notice_when_name_has_html", async () => {
  // 準備
  const { renderNotice } = await loadNotice();
  // 実行
  const html = renderNotice({ name: "<b>x</b>" });
  // 検証
  expect(html).toContain("<code>&lt;b&gt;x&lt;/b&gt;</code>");
});
