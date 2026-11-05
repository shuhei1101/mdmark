import { expect, test } from "vitest";
import { renderDoc } from "../../../helpers/render.ts";

/** キーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadKbd = () => import("../../../../../src/render/syntax/kbd.ts");

// キーにし、打ち消しと空はコードに残す（正常系）
test("test_build_kbds", () => {
  // 準備
  const markdown = "`kbd:Ctrl+C` と `kbd\\:Ctrl+C` と `kbd:`\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<span class="mdmark-kbd-group"><kbd class="mdmark-kbd">Ctrl</kbd><span class="mdmark-kbd-join">+</span><kbd class="mdmark-kbd">C</kbd></span>',
  );
  expect(html).toContain("<code>kbd:Ctrl+C</code>");
  expect(html).toContain("<code>kbd:</code>");
});

// `+` で区切り、`++` を `+` のキーにする（正常系）
test("test_split_keys", async () => {
  // 準備
  const { splitKeys } = await loadKbd();
  // 実行
  const results = ["Ctrl+Shift+P", "Ctrl++", " Ctrl + C "].map((text) =>
    splitKeys(text),
  );
  // 検証
  expect(results).toEqual([
    ["Ctrl", "Shift", "P"],
    ["Ctrl", "+"],
    ["Ctrl", "C"],
  ]);
});
