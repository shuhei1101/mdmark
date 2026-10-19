import { expect, test } from "vitest";
import type { IconName } from "../../../../src/parts/icons.ts";

/** アイコンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIcons = () => import("../../../../src/parts/icons.ts");

/** 外部ライブラリ『lucide』の一覧のうち図と記法で使うアイコンの名前 */
const ICON_NAMES = [
  "plus",
  "minus",
  "rotate-ccw",
  "expand",
  "x",
  "chevron-left",
  "chevron-right",
  "chevron-up",
  "chevron-down",
  "bot",
  "split",
  "code-xml",
  "plug",
  "database",
  "globe",
  "server",
  "info",
  "copy",
  "check",
  "circle-alert",
  "lightbulb",
  "message-square-warning",
  "triangle-alert",
  "octagon-alert",
  "pencil",
  "pin",
  "chevrons-up-down",
  "arrow-up",
  "arrow-down",
  "funnel",
  "link",
  "file",
  "folder",
  "menu",
] as IconName[];

/** 開始タグの名前と属性の名前を、現れた順の `タグ:属性,属性` の並びにする */
function shapeOf(html: string): string[] {
  return (html.match(/<[a-zA-Z][^>]*>/g) ?? []).map((tag) => {
    const name = /^<([a-zA-Z0-9]+)/.exec(tag)?.[1] ?? "";
    const attributes = [...tag.matchAll(/\s([a-zA-Z:-]+)=/g)]
      .map((match) => (match[1] ?? "").toLowerCase())
      .filter((attribute) => attribute !== "data-mdmark-own")
      .sort();
    return `${name}:${attributes.join(",")}`;
  });
}

// lucide の形をそのまま出す（正常系）
test("test_icon_svg", async () => {
  // 準備
  const { iconSvg } = await loadIcons();
  // 実行
  const svg = iconSvg("plus" as IconName);
  // 検証
  expect(svg).toContain('viewBox="0 0 24 24"');
  expect(svg).toContain('d="M5 12h14"');
  expect(svg).toContain('d="M12 5v14"');
  expect(svg.match(/<path\b/g)).toHaveLength(2);
  expect(svg).toContain('aria-hidden="true"');
  expect(svg).toContain('stroke="currentColor"');
});

// 使うアイコンの要素と属性が sanitize で落ちない（正常系）
test("test_icon_svg_when_sanitized", async () => {
  // 準備
  const { iconSvg } = await loadIcons();
  const { sanitize } = await import("../../../../src/render/sanitize.ts");
  const { markOwn } = await import("../../../../src/parts/own.ts");
  const nonce = "test-nonce";
  // 実行・検証
  for (const name of ICON_NAMES) {
    const owned = markOwn(iconSvg(name), nonce);
    const sanitized = sanitize(owned, nonce);
    expect(shapeOf(sanitized), name).toEqual(shapeOf(owned));
  }
  expect(shapeOf(markOwn(iconSvg("database" as IconName), nonce))).toContain(
    "ellipse:cx,cy,rx,ry",
  );
  expect(shapeOf(markOwn(iconSvg("copy" as IconName), nonce))).toContain(
    "rect:height,rx,ry,width,x,y",
  );
});
