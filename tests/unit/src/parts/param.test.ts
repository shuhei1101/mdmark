import { expect, test } from "vitest";
import type { MdmarkParamDefinition } from "../../../../src/diagram/definition.ts";
import { parsed, STRENGTH_TEXT } from "../../helpers/diagrams.ts";
import { findTag, innerHtml, plainText } from "../../helpers/html.ts";

/** 操作できる部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParam = () => import("../../../../src/parts/param.ts");

// 既定の値で描く（正常系）
test("test_render_param", async () => {
  // 準備
  const { renderParam } = await loadParam();
  const definition = parsed<MdmarkParamDefinition>(STRENGTH_TEXT);
  // 実行
  const html = renderParam(definition, { id: "p1" });
  // 検証
  const range = findTag(html, 'type="range"');
  expect(range).toContain('min="0"');
  expect(range).toContain('max="10"');
  expect(range).toContain('step="1"');
  expect(range).toContain('value="5"');
  expect(html).toContain("今の値（5）");
  expect(html).toContain("既定の値（5）");
  expect(plainText(innerHtml(html, "mdmark-param-copy"))).toBe("今の値を写す");
});

// 渡した文言でボタンを描き、HTML の特別な文字をエスケープする（正常系）
test("test_render_param_when_copy_label", async () => {
  // 準備
  const { renderParam } = await loadParam();
  const definition = parsed<MdmarkParamDefinition>(STRENGTH_TEXT);
  // 実行
  const html = renderParam(definition, { id: "p1", copyLabel: "コピー" });
  const escaped = renderParam(definition, {
    id: "p2",
    copyLabel: "<b>写す</b>",
  });
  // 検証
  expect(plainText(innerHtml(html, "mdmark-param-copy"))).toBe("コピー");
  expect(findTag(html, "mdmark-param-copy")).not.toContain("aria-label");
  expect(escaped).toContain("&lt;b&gt;写す&lt;/b&gt;");
  expect(escaped).not.toContain("<b>");
});

// 名前と値を持つ JSON にする（正常系）
test("test_param_json", async () => {
  // 準備
  const { paramJson } = await loadParam();
  const { knob } = parsed<MdmarkParamDefinition>(STRENGTH_TEXT);
  // 実行
  const json = paramJson(knob, 8);
  // 検証
  expect(JSON.parse(json)).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
  expect(json).toContain('\n  "strength"');
});
