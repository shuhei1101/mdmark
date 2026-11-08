import { afterEach, expect, test, vi } from "vitest";
import { addStyles } from "../../helpers/dom.ts";
import { loadSource } from "../../helpers/lazy.ts";

/** 余白のマーカーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMargin = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/comments/margin.ts")>(
      "../../../../src/comments/margin.ts",
    ),
  );

/** マーカーの行どうしが重ならないように空ける段落の上下の余白 */
const PARAGRAPH_STYLE = "margin: 80px 0";

const roots: HTMLElement[] = [];
const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  for (const root of roots.splice(0)) {
    root.remove();
  }
});

/** HTML を本文の列に入れた描く先の要素をページに配置し、本文の列を返却する */
const createContent = (html: string): HTMLElement => {
  addStyles();
  const root = document.createElement("div");
  root.className = "mdmark";
  const content = document.createElement("div");
  content.className = "mdmark-content";
  content.innerHTML = html;
  root.append(content);
  document.body.append(root);
  roots.push(root);
  return content;
};

/** 余白のマーカーを付け、後始末のために削除する関数を記録する */
const attachTracked = async (content: HTMLElement): Promise<() => void> => {
  const { attachMarginMarkers } = await loadMargin();
  const detach = attachMarginMarkers({ content });
  detachers.push(detach);
  return detach;
};

/** 次の描画のタイミングまで待つ */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** 余白の列の中のマーカーを返却する */
const markersOf = (content: HTMLElement): HTMLButtonElement[] => [
  ...(content.parentElement?.querySelectorAll<HTMLButtonElement>(
    ".mdmark-comment-margin .mdmark-comment-marker",
  ) ?? []),
];

/** 要素の最初の行の縦の中ほどを、余白の列の上端からの位置で返却する */
const lineCenter = (target: Element, content: HTMLElement): number => {
  const margin = content.nextElementSibling as HTMLElement;
  const rect = target.getClientRects()[0] as DOMRect;
  return rect.top - margin.getBoundingClientRect().top + rect.height / 2;
};

/** マーカーの `click` が呼ばれた回数を記録する */
const countClicks = (mark: Element): { count: number } => {
  const record = { count: 0 };
  mark.addEventListener("click", () => {
    record.count += 1;
  });
  return record;
};

// マーカーの行の縦の中ほどにマーカーを配置し、押すと吹き出しを開く（正常系）
test("test_attach_margin_markers", async () => {
  // 準備
  const content = createContent(
    [
      `<p style="${PARAGRAPH_STYLE}">導入の<mark class="mdmark-comment-mark">手順</mark>を整える。</p>`,
      `<p style="${PARAGRAPH_STYLE}">テーマの<mark class="mdmark-comment-mark">変数</mark>を記載する。</p>`,
    ].join(""),
  );
  const marks = [...content.querySelectorAll(".mdmark-comment-mark")];
  const clicks = marks.map(countClicks);
  // 実行
  await attachTracked(content);
  await vi.waitFor(() => expect(markersOf(content)).toHaveLength(2));
  // 検証
  expect(content.nextElementSibling?.matches("div.mdmark-comment-margin")).toBe(
    true,
  );
  const markers = markersOf(content);
  marks.forEach((mark, index) => {
    expect(Number.parseFloat(markers[index]?.style.top ?? "")).toBeCloseTo(
      lineCenter(mark, content),
      0,
    );
  });
  // 実行
  markers[0]?.click();
  // 検証
  expect(clicks[0]?.count).toBe(1);
  expect(clicks[1]?.count).toBe(0);
});

// 閉じた中のマーカーは開くボタンの行に配置し、押すと開いてからマーカーを押す（正常系）
test("test_attach_margin_markers_when_closed", async () => {
  // 準備
  const content = createContent(
    [
      `<button type="button" aria-controls="margin-test-section" aria-expanded="false">補足</button>`,
      `<div id="margin-test-section" hidden><p>閉じた<mark class="mdmark-comment-mark">箇所</mark></p></div>`,
    ].join(""),
  );
  const opener = content.querySelector("button") as HTMLButtonElement;
  const section = content.querySelector("#margin-test-section") as HTMLElement;
  let opened = 0;
  opener.addEventListener("click", () => {
    opened += 1;
    section.hidden = false;
    opener.setAttribute("aria-expanded", "true");
  });
  const clicks = countClicks(
    content.querySelector(".mdmark-comment-mark") as Element,
  );
  // 実行
  await attachTracked(content);
  await vi.waitFor(() => expect(markersOf(content)).toHaveLength(1));
  // 検証
  const [marker] = markersOf(content);
  expect(marker?.dataset.closed).toBe("section");
  expect(Number.parseFloat(marker?.style.top ?? "")).toBeCloseTo(
    lineCenter(opener, content),
    0,
  );
  // 実行
  marker?.click();
  // 検証
  expect(opened).toBe(1);
  expect(clicks.count).toBe(1);
});

// 開くボタンが無い閉じた中のマーカーにはマーカーを配置しない（正常系）
test("test_attach_margin_markers_when_no_opener", async () => {
  // 準備
  const content = createContent(
    `<div hidden><p>閉じた<mark class="mdmark-comment-mark">箇所</mark></p></div>`,
  );
  // 実行
  await attachTracked(content);
  await nextFrame();
  await nextFrame();
  // 検証
  expect(markersOf(content)).toHaveLength(0);
});

// 中の変化で次のフレームにもう一度配置する（正常系）
test("test_attach_margin_markers_when_changed", async () => {
  // 準備
  const content = createContent(
    `<p style="${PARAGRAPH_STYLE}">導入の<mark class="mdmark-comment-mark">手順</mark>を整える。</p>`,
  );
  await attachTracked(content);
  await vi.waitFor(() => expect(markersOf(content)).toHaveLength(1));
  // 実行
  const paragraph = document.createElement("p");
  paragraph.setAttribute("style", PARAGRAPH_STYLE);
  paragraph.innerHTML = 'テーマの<mark class="mdmark-comment-mark">変数</mark>';
  content.append(paragraph);
  // 検証
  await vi.waitFor(() => expect(markersOf(content)).toHaveLength(2));
  // 実行
  const [first] = markersOf(content);
  content.nextElementSibling?.append(document.createElement("span"));
  await nextFrame();
  await nextFrame();
  // 検証
  expect(markersOf(content)[0]).toBe(first);
});

// 削除すると余白の列を取り除く（正常系）
test("test_attach_margin_markers_when_detached", async () => {
  // 準備
  const content = createContent(
    `<p style="${PARAGRAPH_STYLE}">導入の<mark class="mdmark-comment-mark">手順</mark>を整える。</p>`,
  );
  const detach = await attachTracked(content);
  await vi.waitFor(() => expect(markersOf(content)).toHaveLength(1));
  // 実行
  detach();
  const paragraph = document.createElement("p");
  paragraph.innerHTML = 'テーマの<mark class="mdmark-comment-mark">変数</mark>';
  content.append(paragraph);
  await nextFrame();
  await nextFrame();
  // 検証
  expect(
    content.parentElement?.querySelector(".mdmark-comment-margin"),
  ).toBeNull();
});
