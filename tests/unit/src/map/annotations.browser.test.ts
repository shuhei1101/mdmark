import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** map の図の注記の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAnnotations = () => import("../../../../src/map/annotations.ts");

/** 脚注の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFootnotePart = () => import("../../../../src/parts/footnote.ts");

afterEach(() => {
  removeRoots();
});

// 範囲の番号と一覧の項目から要素ごとの注記を組む（正常系）
test("test_read_map_annotations", async () => {
  // 準備
  const { readMapAnnotations } = await loadAnnotations();
  const { renderFootnotes } = await loadFootnotePart();
  const list = renderFootnotes({
    kind: "annotation",
    items: [
      {
        number: 1,
        html: "<p>条件の 1 段落目。</p><p>条件の <b>2 段落目</b>。</p>",
        refCount: 1,
        refs: [{ href: "#mdmark-noteref-1-0" }],
      },
      {
        number: 2,
        html: "<p>画像の補足。</p>",
        refCount: 1,
        refs: [{ href: "#mdmark-noteref-2-0" }],
      },
    ],
  });
  const root = createRootFromHtml(
    `<div class="mdmark-map" data-map="1" data-map-annotations="{&quot;cond&quot;:1,&quot;img&quot;:2}"></div>${list}`,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map");
  if (!range) throw new Error("範囲が無い");
  // 実行
  const annotations = readMapAnnotations({
    range,
    notes: {
      judge: { text: "判定", annotations: ["img", "cond"] },
      e1: { annotations: ["missing"] },
    },
  });
  // 検証
  expect(Object.keys(annotations)).toEqual(["judge"]);
  expect(annotations.judge?.map((item) => item.number)).toEqual([1, 2]);
  expect(annotations.judge?.[0]?.html).toBe(
    "条件の 1 段落目。<br>条件の <b>2 段落目</b>。",
  );
  expect(annotations.judge?.[0]?.html).not.toContain("mdmark-fn-back");
  expect(annotations.judge?.[1]?.html).toBe("画像の補足。");
});

// 振り替えた戻るリンクの行き先に持ち主の id を合わせる（正常系）
test("test_link_annotation_owners", async () => {
  // 準備
  const { linkAnnotationOwners } = await loadAnnotations();
  const root = createRootFromHtml(
    [
      '<div class="mdmark-map" data-map="1"><button id="mdmark-note-owner-1-judge" type="button">i</button></div>',
      '<details class="mdmark-footnotes mdmark-notes"><ol class="mdmark-footnotes-list"><li class="mdmark-fn-item" id="mdmark-note-3-1"><p>条件 <a class="mdmark-fn-back" href="#mdmark-note-owner-3-1-judge" data-note-owner="mdmark-note-owner-1-judge">戻る</a></p></li></ol></details>',
    ].join(""),
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map");
  if (!range) throw new Error("範囲が無い");
  // 実行
  linkAnnotationOwners(range);
  // 検証
  expect(range.querySelector("button")?.id).toBe("mdmark-note-owner-3-1-judge");
});
