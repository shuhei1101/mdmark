import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { MdmarkFlowDefinition } from "../../../../src/diagram/definition.ts";
import {
  renderDiagramFrame,
  renderFlow,
} from "../../../../src/parts/diagram.ts";
import { wrapHtml } from "../../helpers/charts.ts";
import { REPLY_TIME_TEXT, wrapDirective } from "../../helpers/diagrams.ts";
import {
  addStyles,
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { erText, shopEr } from "../../helpers/er.ts";
import { renderDoc } from "../../helpers/render.ts";

/** 図のツールチップの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTips = () => import("../../../../src/interact/diagram-tips.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.useRealTimers();
});

/** `tip` を持つ線のラベル（ツールチップの持ち主）を返却する */
function tipOwner(figure: ParentNode): HTMLElement {
  const owner = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-label.has-tip",
  );
  if (!owner) {
    throw new Error("ツールチップを持つ線のラベルが無い");
  }
  return owner;
}

/** 持ち主が指すツールチップ */
function tipOf(owner: HTMLElement): HTMLElement {
  const tip = document.getElementById(
    owner.getAttribute("aria-describedby") ?? "",
  );
  if (!tip) {
    throw new Error("ツールチップが無い");
  }
  return tip;
}

/** 説明を持つノード 1 つ・説明を持たないノード 1 つと、説明を持つラベルの線の map の構成図のノードと線 */
const TIP_FLOW: MdmarkFlowDefinition = {
  width: 520,
  height: 160,
  nodes: [
    {
      id: "recv",
      name: "受け取り",
      hint: "問い合わせのメールを 1 通ずつ読む",
      x: 24,
      y: 40,
      w: 180,
      h: 72,
      style: { label: "処理", icon: "cog" },
    },
    {
      id: "store",
      name: "記録",
      x: 316,
      y: 40,
      w: 180,
      h: 72,
      style: { label: "保存先", icon: "database" },
    },
  ],
  wires: [
    {
      id: "recv->store",
      from: "recv",
      to: "store",
      points: [
        [204, 76],
        [316, 76],
      ],
      label: "保存",
      labelAt: [260, 76],
      tip: "本文と送信者のアドレス",
      style: {},
    },
  ],
};

/** map の構成図のノードと線を図の枠に描いた `figure` */
function createFigure(): HTMLElement {
  const root = createRootFromHtml(
    renderDiagramFrame(
      { kind: "map", title: "問い合わせの処理", legend: [], id: "tips" },
      renderFlow(TIP_FLOW, "tips", { hints: true }),
    ),
  );
  const figure = root.querySelector<HTMLElement>("figure.mdmark-diagram");
  if (!figure) {
    throw new Error("図が描かれていない");
  }
  return figure;
}

// フォーカスで開き、Esc で閉じてフォーカスを持ち主に残す（正常系）
test("test_attach_diagram_tips", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const owner = tipOwner(figure);
  // 実行
  owner.focus();
  // 検証
  const tip = tipOf(owner);
  expect(tip.hidden).toBe(false);
  await userEvent.keyboard("{Escape}");
  expect(tip.hidden).toBe(true);
  expect(document.activeElement).toBe(owner);
});

// ツールチップの上では閉じない（正常系）
test("test_attach_diagram_tips_when_hovered", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const owner = tipOwner(figure);
  const tip = tipOf(owner);
  owner.dispatchEvent(new PointerEvent("pointerenter"));
  // 実行
  owner.dispatchEvent(new PointerEvent("pointerleave"));
  tip.dispatchEvent(new PointerEvent("pointerenter"));
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(false);
});

// ノードのマーカーの外では開かない（正常系）
test("test_attach_diagram_tips_when_box_hovered", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const info = figure.querySelector<HTMLElement>(".mdmark-diagram-info");
  const box = info?.closest<HTMLElement>(".mdmark-diagram-node");
  const name = box?.querySelector<HTMLElement>(".mdmark-diagram-node-name");
  if (!info || !box || !name) {
    throw new Error("説明を持つノードが無い");
  }
  const tip = tipOf(info);
  // 実行
  box.dispatchEvent(new PointerEvent("pointerenter"));
  name.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tip.hidden).toBe(true);
  // 実行
  info.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tip.hidden).toBe(false);
});

/** 埋め込んだ HTML のヒント: ブロックの要素 1 つと、行内の要素 1 つ */
const HINT_BODY = [
  '<div data-hint="ブロックの説明" style="width: 20rem; padding: 1rem">ブロックの文字</div>',
  '<p>前の文字 <span data-hint="行内の説明">行内の単語</span> 後ろの文字</p>',
].join("\n");

/** ヒントを持つ埋め込んだ HTML を描いた `div.mdmark-html` */
function createEmbedded(): HTMLElement {
  const { root } = createRoot(wrapHtml(HINT_BODY));
  const embedded = root.querySelector<HTMLElement>("div.mdmark-html");
  if (!embedded) {
    throw new Error("埋め込んだ HTML が描かれていない");
  }
  return embedded;
}

/** 開いている（`hidden` でない）ツールチップの数 */
function openCount(scope: ParentNode): number {
  return [...scope.querySelectorAll<HTMLElement>('[role="tooltip"]')].filter(
    (tip) => !tip.hidden,
  ).length;
}

// 埋め込んだ HTML のヒントを開く（正常系）
test("test_attach_diagram_tips_when_embedded_hint", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const embedded = createEmbedded();
  const { detach } = attachDiagramTips({ figure: embedded, placement: "top" });
  detachers.push(detach);
  const block = embedded.querySelector<HTMLElement>(".mdmark-hint-block");
  const mark = embedded.querySelector<HTMLElement>(".mdmark-hint-mark");
  const inline = embedded.querySelector<HTMLElement>(".mdmark-hint-inline");
  if (!block || !mark || !inline) {
    throw new Error("ヒントの要素が描かれていない");
  }
  // 実行: ブロックの要素の文字の上
  block.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(openCount(embedded)).toBe(0);
  // 実行: マーカーの上
  mark.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tipOf(mark).hidden).toBe(false);
  expect(tipOf(mark).textContent).toContain("ブロックの説明");
  expect(openCount(embedded)).toBe(1);
  // 実行: 行内の要素の上
  inline.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tipOf(inline).hidden).toBe(false);
  expect(tipOf(inline).textContent).toContain("行内の説明");
  expect(tipOf(mark).hidden).toBe(true);
  expect(openCount(embedded)).toBe(1);
});

// 同じページに 2 回描いてもヒントの id が重ならない（正常系）
test("test_attach_diagram_tips_when_embedded_unique_ids", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const { html } = renderDoc(wrapHtml(HINT_BODY));
  const roots = [createRootFromHtml(html), createRootFromHtml(html)];
  // 実行
  for (const root of roots) {
    const embedded = root.querySelector<HTMLElement>("div.mdmark-html");
    if (!embedded) {
      throw new Error("埋め込んだ HTML が描かれていない");
    }
    detachers.push(
      attachDiagramTips({ figure: embedded, placement: "top" }).detach,
    );
  }
  // 検証
  const ids = roots.flatMap((root) =>
    [...root.querySelectorAll("[id]")].map((element) => element.id),
  );
  expect(ids.length).toBeGreaterThanOrEqual(4);
  expect(new Set(ids).size).toBe(ids.length);
  for (const root of roots) {
    const owners = root.querySelectorAll<HTMLElement>("[aria-describedby]");
    expect(owners.length).toBe(2);
    for (const owner of owners) {
      expect(root.contains(tipOf(owner))).toBe(true);
    }
  }
});

// 上に収まれば持ち主の上、bottom では下にツールチップを配置する（正常系）
test("test_attach_diagram_tips_when_placed", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const targets = [
    {
      name: "線のラベル",
      create: createFigure,
      owner: tipOwner,
    },
    {
      name: "ブロックのヒントのマーカー",
      create: createEmbedded,
      owner: (embedded: HTMLElement) => {
        const mark = embedded.querySelector<HTMLElement>(".mdmark-hint-mark");
        if (!mark) {
          throw new Error("ヒントのマーカーが描かれていない");
        }
        return mark;
      },
    },
  ];
  for (const target of targets) {
    for (const placement of ["top", "bottom"] as const) {
      const host = target.create();
      // 上にも下にも収まるよう、持ち主を画面の中ほどに配置する
      host
        .closest<HTMLElement>(".mdmark")
        ?.style.setProperty("margin", "100vh 0");
      const { detach } = attachDiagramTips({ figure: host, placement });
      detachers.push(detach);
      const owner = target.owner(host);
      owner.scrollIntoView({ block: "center" });
      // 実行
      owner.focus();
      // 検証
      const tipRect = tipOf(owner).getBoundingClientRect();
      const ownerRect = owner.getBoundingClientRect();
      if (placement === "top") {
        expect(tipRect.bottom, `${target.name} の top`).toBeLessThanOrEqual(
          ownerRect.top,
        );
      } else {
        expect(tipRect.top, `${target.name} の bottom`).toBeGreaterThanOrEqual(
          ownerRect.bottom,
        );
      }
      detach();
      removeRoots();
    }
  }
});

/** 入力・処理・出力を持つノードの右上のマーカー */
function infoMark(figure: ParentNode): HTMLElement {
  const info = figure.querySelector<HTMLElement>(".mdmark-diagram-info");
  if (!info) {
    throw new Error("入力・処理・出力を持つノードのマーカーが無い");
  }
  return info;
}

/** ブロックのヒントのマーカー */
function hintMark(embedded: ParentNode): HTMLElement {
  const mark = embedded.querySelector<HTMLElement>(".mdmark-hint-mark");
  if (!mark) {
    throw new Error("ヒントのマーカーが描かれていない");
  }
  return mark;
}

/** ポインターの種類を指定したポインターのイベント */
function pointer(type: string, pointerType: string): PointerEvent {
  return new PointerEvent(type, {
    pointerType,
    bubbles: type === "pointerdown" || type === "pointerup",
  });
}

/**
 * タッチのタップを、実際の順序（`pointerenter`・`pointerdown`・`pointerup`・`pointerleave` の後にフォーカス）で発生させる。
 * `focus()` は既にフォーカスを持つ持ち主では `focus` を発火しない
 */
function tap(owner: HTMLElement): void {
  for (const type of [
    "pointerenter",
    "pointerdown",
    "pointerup",
    "pointerleave",
  ]) {
    owner.dispatchEvent(pointer(type, "touch"));
  }
  owner.focus();
}

// タッチの 1 回のタップで開き、もう一度のタップで閉じる（正常系）
test("test_attach_diagram_tips_when_touch_tapped", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const mark = infoMark(figure);
  const tip = tipOf(mark);
  // 実行
  tap(mark);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(false);
  // 実行
  tap(mark);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(true);
});

// タッチで開いた後、外の pointerdown だけで閉じ、ツールチップの中では閉じない（正常系）
test("test_attach_diagram_tips_when_touch_outside", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const mark = infoMark(figure);
  const tip = tipOf(mark);
  const outside = document.createElement("p");
  document.body.append(outside);
  detachers.push(() => outside.remove());
  tap(mark);
  // 実行: ツールチップの中
  tip.dispatchEvent(pointer("pointerdown", "touch"));
  // 検証
  expect(tip.hidden).toBe(false);
  // 実行: 図の外（pointerleave・blur は送信しない）
  outside.dispatchEvent(pointer("pointerdown", "touch"));
  // 検証
  expect(tip.hidden).toBe(true);
});

// 埋め込んだ HTML のヒントもタッチで開閉する（正常系）
test("test_attach_diagram_tips_when_touch_embedded_hint", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachDiagramTips } = await loadTips();
  const embedded = createEmbedded();
  const { detach } = attachDiagramTips({ figure: embedded, placement: "top" });
  detachers.push(detach);
  const mark = hintMark(embedded);
  const tip = tipOf(mark);
  const outside = document.createElement("p");
  document.body.append(outside);
  detachers.push(() => outside.remove());
  // 実行
  tap(mark);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(false);
  // 実行
  tap(mark);
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(true);
  // 実行
  tap(mark);
  outside.dispatchEvent(pointer("pointerdown", "touch"));
  // 検証
  expect(tip.hidden).toBe(true);
});

// マウスの pointerdown では開閉を切り替えない（正常系）
test("test_attach_diagram_tips_when_mouse_pressed", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const mark = infoMark(figure);
  const tip = tipOf(mark);
  mark.dispatchEvent(pointer("pointerenter", "mouse"));
  // 実行
  mark.dispatchEvent(pointer("pointerdown", "mouse"));
  // 検証
  expect(tip.hidden).toBe(false);
});

// タッチで開いた後、ツールチップの中のタップでは閉じない（正常系）
test("test_attach_diagram_tips_when_touch_tip_tapped", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips({ figure, placement: "top" });
  detachers.push(detach);
  const mark = infoMark(figure);
  const tip = tipOf(mark);
  tap(mark);
  // 実行: ツールチップの中のタップ（フォーカスできない所なので、持ち主のフォーカスが離れる）
  for (const type of ["pointerdown", "pointerup", "pointerleave"]) {
    tip.dispatchEvent(pointer(type, "touch"));
  }
  mark.blur();
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(false);
});

// グラフの項目とグループのタイトルのマーカーで開き、bottom で下に配置する（正常系）
test("test_attach_diagram_tips_when_chart_item", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const { root } = createRoot(
    `${wrapDirective("chart", REPLY_TIME_TEXT)}\n\n${wrapDirective("er", erText(shopEr()))}`,
  );
  const [chart, er] = [
    ...root.querySelectorAll<HTMLElement>("figure.mdmark-diagram"),
  ];
  if (!chart || !er) {
    throw new Error("図が描かれていない");
  }
  for (const figure of [chart, er]) {
    const { detach } = attachDiagramTips({ figure, placement: "bottom" });
    detachers.push(detach);
  }
  const item = chart.querySelector<HTMLElement>(".mdmark-diagram-item-hit");
  const tableMark = er.querySelector<HTMLElement>(".mdmark-diagram-info");
  if (!item || !tableMark) {
    throw new Error("グラフの項目かテーブルの説明のボタンが無い");
  }
  // 実行: グラフの項目にフォーカスする
  item.focus();
  // 検証
  const itemTip = tipOf(item);
  expect(itemTip.hidden).toBe(false);
  expect(itemTip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    item.getBoundingClientRect().bottom,
  );
  // 実行: テーブルの説明のボタンにポインターを乗せる
  tableMark.dispatchEvent(
    new PointerEvent("pointerenter", { pointerType: "mouse" }),
  );
  // 検証
  const tableTip = tipOf(tableMark);
  expect(tableTip.hidden).toBe(false);
  expect(tableTip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    tableMark.getBoundingClientRect().bottom,
  );
  const open = [...er.querySelectorAll<HTMLElement>('[role="tooltip"]')].filter(
    (tip) => !tip.hidden,
  );
  expect(open).toHaveLength(1);
});
