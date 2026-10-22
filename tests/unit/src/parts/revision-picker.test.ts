import { expect, test } from "vitest";
import { innerHtml, outerHtml, plainText } from "../../helpers/html.ts";

/** リビジョンの選択の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPicker = () => import("../../../../src/parts/revision-picker.ts");

// 部品設計の状態 Normal の引数
const NORMAL = {
  revisions: [
    {
      id: "r3",
      at: "2026-10-20T02:05:00Z",
      label: "見出しを書き換える",
      author: "田中",
    },
    {
      id: "r2",
      at: "2026-10-19T07:40:00Z",
      label: "件数を直す",
      author: "鈴木",
    },
    {
      id: "r1",
      at: "2026-10-18T00:12:00Z",
      label: "初版",
      author: "佐藤",
    },
  ],
  before: "r2",
  after: "r3",
  counts: { del: 1, add: 8 },
  idPrefix: "p",
};

/** 選択肢 1 つ分の属性と文字 */
type Option = { attributes: string; text: string };

/** `ラベルの文字` を持つ label が指す select の選択肢を返す */
function optionsOf(html: string, labelText: string): Map<string, Option> {
  const label = /<label[^>]*for="([^"]+)"[^>]*>([^<]*)<\/label>/g;
  let id: string | undefined;
  for (let match = label.exec(html); match; match = label.exec(html)) {
    if (match[2] === labelText) {
      id = match[1];
    }
  }
  if (id === undefined) {
    throw new Error(`label が無い: ${labelText}`);
  }
  const options = new Map<string, Option>();
  const pattern = /<option([^>]*)>([^<]*)<\/option>/g;
  const inner = innerHtml(html, `id="${id}"`);
  for (let match = pattern.exec(inner); match; match = pattern.exec(inner)) {
    const value = /value="([^"]*)"/.exec(match[1] ?? "")?.[1];
    if (value !== undefined) {
      options.set(value, { attributes: match[1] ?? "", text: match[2] ?? "" });
    }
  }
  return options;
}

/** 選択肢が属性を持つか */
const has = (option: Option | undefined, attribute: string): boolean =>
  new RegExp(`\\b${attribute}\\b`).test(option?.attributes ?? "");

// 選んだリビジョンと選べない項目を出す（正常系）
test("test_render_revision_picker", async () => {
  // 準備
  const { renderRevisionPicker } = await loadPicker();
  // 実行
  const html = renderRevisionPicker(NORMAL);
  // 検証
  const before = optionsOf(html, "前のリビジョン");
  const after = optionsOf(html, "後のリビジョン");
  expect(has(before.get("r2"), "selected")).toBe(true);
  expect(has(after.get("r3"), "selected")).toBe(true);
  expect(has(before.get("r3"), "disabled")).toBe(true);
  expect(has(after.get("r2"), "disabled")).toBe(true);
  expect(has(after.get("r1"), "disabled")).toBe(true);
  expect(has(before.get("r1"), "disabled")).toBe(false);
  expect(has(after.get("r3"), "disabled")).toBe(false);
  expect(before.get("r2")?.text).toBe("2026/10/19 16:40 件数を直す（鈴木）");
  const status = plainText(outerHtml(html, 'role="status"'));
  expect(status).toContain("削除した行 1・追加した行 8");
});
