import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, outerHtml } from "../../helpers/html.ts";
import { loadSource } from "../../helpers/lazy.ts";

/** 左右に並べる差分の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPart = () =>
  loadSource(
    import.meta.glob<
      typeof import("../../../../src/diff/diff-side-by-side.part.ts")
    >("../../../../src/diff/diff-side-by-side.part.ts"),
  );

// 変えていない・書き換えた・追加した・削除した 4 行
const ROWS = [
  { kind: "same", before: "<h2>手順</h2>", after: "<h2>手順</h2>" },
  { kind: "change", before: "<p>前の段落</p>", after: "<p>後の段落</p>" },
  { kind: "add", after: "<p>足した段落</p>" },
  { kind: "del", before: "<p>消した段落</p>" },
] as const;

/** 4 行を描く */
async function render(): Promise<string> {
  const { renderDiffSideBySide } = await loadPart();
  return renderDiffSideBySide({
    before: { label: "初版" },
    after: { label: "件数を修正する" },
    rows: [...ROWS],
    idPrefix: "mdmark-diff-panel-1",
  });
}

/** セルの中身を、変えていない・削除の色・追加の色・空きのどれかに分ける */
function cellKind(cell: string): string {
  if (cell.includes("mdmark-diff-pair-gap")) return "gap";
  if (cell.includes('data-kind="del"')) return "del";
  if (cell.includes('data-kind="add"')) return "add";
  return "same";
}

/** 列の中のセルを、上から順に分ける */
function columnKinds(column: string): string[] {
  return column
    .split('<div class="mdmark-diff-pair-cell"')
    .slice(1)
    .map(cellKind);
}

// 広い幅の 2 列に、行の種類ごとのセルを並べる（正常系）
test("test_render_diff_side_by_side", async () => {
  // 準備・実行
  const html = await render();
  // 検証
  const wide = outerHtml(html, 'class="mdmark-diff-pair"');
  const sections = findTags(wide, "mdmark-diff-pair-col");
  expect(sections).toHaveLength(2);
  expect(sections[0]).toContain('aria-labelledby="mdmark-diff-panel-1-before"');
  expect(sections[1]).toContain('aria-labelledby="mdmark-diff-panel-1-after"');
  expect(innerHtml(wide, 'id="mdmark-diff-panel-1-before"')).toContain("前: ");
  expect(innerHtml(wide, 'id="mdmark-diff-panel-1-after"')).toContain("後: ");
  const [before, after] = wide
    .split("<section")
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("</section>")));
  expect(columnKinds(before ?? "")).toEqual(["same", "del", "gap", "del"]);
  expect(columnKinds(after ?? "")).toEqual(["same", "add", "add", "gap"]);
  for (const gap of findTags(wide, "mdmark-diff-pair-gap")) {
    expect(gap).toContain('aria-hidden="true"');
  }
});

// 狭い幅の 1 列は、変えた行ごとに前の下に後を並べる（正常系）
test("test_render_diff_side_by_side_when_stacked", async () => {
  // 準備・実行
  const html = await render();
  // 検証
  expect(findTag(html, "mdmark-diff-pair-stacked")).toMatch(/^<div\b/);
  const stacked = innerHtml(html, "mdmark-diff-pair-stacked");
  const order = [
    ...stacked.matchAll(
      /<h2>手順<\/h2>|<p class="mdmark-diff-pair-label">(前|後): [^<]*<\/p>|data-kind="(add|del)"/g,
    ),
  ].map((match) =>
    match[0].startsWith("<h2") ? "same" : (match[1] ?? match[2] ?? ""),
  );
  expect(order).toEqual([
    "same",
    "前",
    "del",
    "後",
    "add",
    "後",
    "add",
    "前",
    "del",
  ]);
});
