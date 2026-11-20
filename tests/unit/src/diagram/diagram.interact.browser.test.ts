import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { MdmarkFlowDefinition } from "../../../../src/diagram/definition.ts";
import {
  renderDiagramFrame,
  renderFlow,
} from "../../../../src/diagram/diagram.part.ts";
import { renderMermaidDiagram } from "../../../../src/diagram/mermaid.part.ts";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { memoryStorage } from "../../helpers/storage.ts";

/** 図の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiagrams = () =>
  import("../../../../src/diagram/diagram.interact.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 幅 `width`・高さ `height` の mermaid の図を図の枠に描いた HTML（枠の id は `id`） */
function mermaidFigure(width: number, height: number, id: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="none"></rect></svg>`;
  return renderDiagramFrame(
    { kind: "mermaid", title: "大きさを決めた図", legend: [], id },
    renderMermaidDiagram({ svg, width, height }),
  );
}

/** 幅 `rootWidth`px の描く先の要素に、幅 `width`・高さ `height` の mermaid の図を描く */
function createSizedRoot(
  size: { width: number; height: number },
  rootWidth = 600,
): HTMLElement {
  const root = createRootFromHtml(mermaidFigure(size.width, size.height, "d1"));
  root.style.width = `${rootWidth}px`;
  root.style.setProperty("--mdmark-padding", "0");
  return root;
}

/** 幅 600px の描く先の要素に、幅 1100 の mermaid の図を描く */
function createDiagramRoot(): HTMLElement {
  return createSizedRoot({ width: 1100, height: 400 });
}

/** 幅 600px の描く先の要素に、幅 600・高さ 1200 の mermaid の図（全体が収まる倍率が 1 になる縦長の図）を描く */
function createTallDiagramRoot(): HTMLElement {
  return createSizedRoot({ width: 600, height: 1200 });
}

/** 説明を持つノード 2 つの map の構成図（幅 1100） */
const TIP_FLOW: MdmarkFlowDefinition = {
  width: 1100,
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
      hint: "本文と送信者のアドレスを保存する",
      x: 896,
      y: 40,
      w: 180,
      h: 72,
      style: { label: "保存先", icon: "database" },
    },
  ],
  wires: [],
};

/** 幅 600px の描く先の要素に、説明を持つノード 2 つの map の構成図を描く */
function createTipRoot(): HTMLElement {
  const root = createRootFromHtml(
    renderDiagramFrame(
      { kind: "map", title: "問い合わせの処理", legend: [], id: "tips" },
      renderFlow(TIP_FLOW, "tips", { hints: true }),
    ),
  );
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  return root;
}

/** スクリーンリーダー向けの名前でボタンを探す */
function button(root: ParentNode, name: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
  if (!found) {
    throw new Error(`ボタンが無い: ${name}`);
  }
  return found;
}

/** 倍率のボタン（スクリーンリーダー向けの名前が `倍率 {今の倍率}。全体が収まる倍率に戻す`） */
function zoomButton(root: ParentNode): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    'button[aria-label^="倍率"]',
  );
  if (!found) {
    throw new Error("倍率のボタンが無い");
  }
  return found;
}

/** 倍率の表示 */
function zoomText(root: ParentNode): string {
  return zoomButton(root).textContent ?? "";
}

/** 図の表示する枠 */
function viewportOf(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>(
    '[role="group"][aria-roledescription="図"]',
  );
  if (!found) {
    throw new Error("表示する枠が無い");
  }
  return found;
}

// 全体が収まる倍率で開き、拡大と戻すができる（正常系）
test("test_attach_diagrams", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  // 実行
  detachers.push(attachDiagrams({ root, placement: "top" }));
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(button(root, "縮小").disabled).toBe(false);
  button(root, "拡大").click();
  expect(zoomText(root)).toBe("125%");
  viewportOf(root).focus();
  await userEvent.keyboard("0");
  expect(zoomText(root)).toBe("100%");
});

// 上限で拡大を押せなくする（正常系）
test("test_attach_diagrams_when_max", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  // 実行
  for (let i = 0; i < 10; i += 1) {
    button(root, "拡大").click();
  }
  // 検証
  expect(zoomText(root)).toBe("500%");
  expect(button(root, "拡大").disabled).toBe(true);
});

// 拡大した間だけ表示する枠の data-at-fit を外し、矢印キーで動かす（正常系）
test("test_attach_diagrams_when_panned", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  expect(viewportOf(root).hasAttribute("data-at-fit")).toBe(true);
  button(root, "拡大").click();
  button(root, "拡大").click();
  const viewport = viewportOf(root);
  const before = viewport.scrollLeft;
  // 実行
  viewport.focus();
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(viewport.hasAttribute("data-at-fit")).toBe(false);
  expect(root.querySelector('[data-group="pan"]')).toBeNull();
  expect(viewport.scrollLeft - before).toBe(80);
});

// 倍率のボタンで開いたときの倍率と位置に戻す（正常系）
test("test_attach_diagrams_when_zoom_button", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  button(root, "拡大").click();
  button(root, "拡大").click();
  const viewport = viewportOf(root);
  viewport.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(viewport.scrollLeft).toBeGreaterThan(0);
  expect(zoomButton(root).getAttribute("aria-label")).toBe(
    "倍率 156%。全体が収まる倍率に戻す",
  );
  // 実行
  zoomButton(root).click();
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(viewport.scrollLeft).toBe(0);
  expect(zoomButton(root).getAttribute("aria-label")).toBe(
    "倍率 100%。全体が収まる倍率に戻す",
  );
  // 実行: 開いたときの倍率のままでも押せる
  expect(zoomButton(root).disabled).toBe(false);
  zoomButton(root).click();
  // 検証
  expect(zoomText(root)).toBe("100%");
});

// ホイールで倍率を変えず、開いたときの倍率では受け取らない（正常系）
test("test_attach_diagrams_when_wheel", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const viewport = viewportOf(root);
  const event = new WheelEvent("wheel", {
    deltaY: -100,
    bubbles: true,
    cancelable: true,
  });
  // 実行
  viewport.dispatchEvent(event);
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(event.defaultPrevented).toBe(false);
});

// 開いたときの高さを --mdmark-diagram-max-height で抑え、上限を図の全体が収まる高さにする（正常系）
test("test_attach_diagrams_when_tall", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createTallDiagramRoot();
  // 実行
  detachers.push(attachDiagrams({ root, placement: "top" }));
  // 検証
  const viewport = viewportOf(root);
  expect(viewport.clientHeight).toBe(576);
  expect(viewport.style.maxHeight).toBe("1200px");
});

// 利用側が高さを変えると、36rem を超えて図の全体が収まる高さまで広がり、倍率に合わせて上限を付け替える（正常系）
test("test_attach_diagrams_when_resized", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createTallDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const viewport = viewportOf(root);
  // 実行: 36rem を超える高さにする
  viewport.style.height = "1000px";
  // 検証
  expect(viewport.clientHeight).toBe(1000);
  // 実行: 図の全体が収まる高さを超える高さにする
  viewport.style.height = "1500px";
  // 検証: 上限で止まる
  expect(viewport.clientHeight).toBe(1200);
  // 実行: 拡大する
  button(root, "拡大").click();
  // 検証: 上限を今の倍率に合わせる
  expect(viewport.style.maxHeight).toBe("1500px");
  // 実行: 開いたときの倍率に戻す
  viewport.focus();
  await userEvent.keyboard("0");
  // 検証
  expect(viewport.clientHeight).toBe(576);
  expect(viewport.style.maxHeight).toBe("1200px");
});

// 削除すると監視も削除される（正常系）
test("test_attach_diagrams_when_cleaned_up", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const disconnect = vi.spyOn(ResizeObserver.prototype, "disconnect");
  const root = createDiagramRoot();
  const detach = attachDiagrams({ root, placement: "top" });
  // 実行
  detach();
  button(root, "拡大").click();
  // 検証
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(zoomText(root)).toBe("100%");
});

// 全画面を開いて Esc で閉じ、フォーカスを全画面のボタンへ戻す（正常系）
test("test_open_diagram_dialog", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  button(root, "表示の操作を開く").click();
  const opener = button(root, "全画面で開く");
  // 実行
  opener.click();
  // 検証
  expect(root.querySelectorAll("dialog[open]")).toHaveLength(1);
  await userEvent.keyboard("{Escape}");
  expect(root.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

// 複製した図に部品の操作を付け直し、閉じたら解除する（正常系）
test("test_open_diagram_dialog_when_attach_modal", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  const calls: Array<{ modal: HTMLElement; source: HTMLElement }> = [];
  let detached = 0;
  detachers.push(
    attachDiagrams({
      root,
      placement: "top",
      attachModal: (modal, source) => {
        calls.push({ modal, source });
        return () => {
          detached += 1;
        };
      },
    }),
  );
  const figure = root.querySelector("figure.mdmark-diagram");
  button(root, "表示の操作を開く").click();
  // 実行
  button(root, "全画面で開く").click();
  const dialog = root.querySelector("dialog");
  // 検証
  expect(calls).toHaveLength(1);
  expect(dialog?.contains(calls[0]?.modal ?? null)).toBe(true);
  expect(calls[0]?.source).toBe(figure);
  expect(detached).toBe(0);
  button(dialog as HTMLElement, "全画面を閉じる").click();
  // dialog の close イベントは非同期に届く
  await vi.waitFor(() => expect(detached).toBe(1));
});

// ツールチップを開いている間の Esc は、何度でもツールチップだけを閉じる（正常系）
test("test_open_diagram_dialog_when_tip_open", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createTipRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  button(root, "表示の操作を開く").click();
  button(root, "全画面で開く").click();
  const dialog = root.querySelector("dialog");
  if (!dialog) {
    throw new Error("全画面が開いていない");
  }
  const owners = [
    ...dialog.querySelectorAll<HTMLElement>(
      ".mdmark-diagram-info[aria-describedby]",
    ),
  ];
  expect(owners.length).toBeGreaterThanOrEqual(2);
  // 実行・検証
  for (const owner of owners.slice(0, 2)) {
    // 右上のパネルが重なるマーカーもあるため、フォーカスでツールチップを開く
    owner.focus();
    const tip = document.getElementById(
      owner.getAttribute("aria-describedby") ?? "",
    );
    expect(tip?.hidden).toBe(false);
    await userEvent.keyboard("{Escape}");
    expect(tip?.hidden).toBe(true);
    expect(dialog.open).toBe(true);
  }
});

/** 表示する枠の右下のリサイズハンドル */
function handleOf(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>(".mdmark-diagram-resize");
  if (!found) {
    throw new Error("リサイズハンドルが無い");
  }
  return found;
}

// リサイズハンドルで高さを変えると、全体が収まる倍率を幅と高さでもう一度求め、もう一度付けても保つ（正常系）
test("test_attach_diagrams_when_handle_resized", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachDiagrams } = await loadDiagrams();
  // 幅 500・高さ 1600 の図（全体が収まる倍率は幅で決まり 1 になる縦長の図）
  const root = createSizedRoot({ width: 500, height: 1600 });
  const storage = memoryStorage();
  const detach = attachDiagrams({ root, placement: "bottom", storage });
  const viewport = viewportOf(root);
  const handle = handleOf(root);
  const point = { bubbles: true, pointerId: 1, button: 0, clientX: 10 };
  // 実行: 200px 下へドラッグする
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientY: 100 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientY: 300 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientY: 300 }),
  );
  // 検証: 高さが 576 + 200 になり、倍率は変わらない（全体が収まる倍率が下がった分、倍率の文字は 100% より大きい）
  expect(viewport.clientHeight).toBe(776);
  expect(zoomText(root)).not.toBe("100%");
  // 実行: 全体が収まる倍率に戻す
  viewport.focus();
  await userEvent.keyboard("0");
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight + 1);
  // 実行: 削除してもう一度付ける
  detach();
  detachers.push(attachDiagrams({ root, placement: "bottom", storage }));
  // 検証
  expect(viewportOf(root).clientHeight).toBe(776);
});

// 指定した図だけに付け、倍率の下限を守る（正常系）
test("test_attach_diagrams_when_figures_given", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createRootFromHtml(
    `${mermaidFigure(1100, 400, "d1")}\n${mermaidFigure(1100, 400, "d2")}`,
  );
  root.style.width = "300px";
  root.style.setProperty("--mdmark-padding", "0");
  const [other, floored] = [
    ...root.querySelectorAll<HTMLElement>("figure.mdmark-diagram"),
  ];
  if (other === undefined || floored === undefined) {
    throw new Error("図が 2 つ無い");
  }
  floored.dataset.fitMin = "0.75";
  // 実行
  detachers.push(
    attachDiagrams({ root, placement: "bottom", figures: [floored] }),
  );
  // 検証
  const content = floored.querySelector<HTMLElement>(".mdmark-diagram-stage");
  expect(content?.style.transform).toBe("scale(0.75)");
  button(floored, "拡大").click();
  expect(content?.style.transform).not.toBe("scale(0.75)");
  const before = zoomText(other);
  button(other, "拡大").click();
  expect(zoomText(other)).toBe(before);
});

/** 幅 600・高さ 1200 の図に高さ 60px の参加者の行を入れた、表示する枠が高さ 400px の map のシーケンス図の描く先の要素 */
function createSequenceRoot(): HTMLElement {
  const root = createSizedRoot({ width: 600, height: 1200 });
  root.style.setProperty("--mdmark-diagram-max-height", "400px");
  root.style.setProperty("--mdmark-sticky-top", "48px");
  const figure = root.querySelector<HTMLElement>("figure.mdmark-diagram");
  if (figure) figure.dataset.diagram = "map";
  root
    .querySelector(".mdmark-diagram-stage")
    ?.insertAdjacentHTML(
      "afterbegin",
      '<div class="mdmark-diagram-seq-heads" style="width:600px;height:60px"></div>',
    );
  return root;
}

/** 参加者の行の `transform` */
const headsTransform = (root: ParentNode): string =>
  root.querySelector<HTMLElement>(".mdmark-diagram-seq-heads")?.style
    .transform ?? "";

// 文書をスクロールすると参加者の行を画面の上端に留め、下端で押し上げる（正常系）
test("test_attach_diagrams_when_page_scrolled", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createSequenceRoot();
  const spacer = document.createElement("div");
  spacer.style.height = "3000px";
  document.body.append(spacer);
  detachers.push(() => spacer.remove());
  detachers.push(attachDiagrams({ root, placement: "bottom" }));
  const viewport = viewportOf(root);
  const scrollBy = (target: number) => {
    window.scrollBy(0, viewport.getBoundingClientRect().top - target);
    window.dispatchEvent(new Event("scroll"));
  };
  // 実行: 表示する枠の上端を画面の上端より 100px 上に出す
  scrollBy(-100);
  // 検証
  await vi.waitFor(() =>
    expect(headsTransform(root)).toBe("translateY(148px)"),
  );
  expect(
    root
      .querySelector(".mdmark-diagram-seq-heads")
      ?.classList.contains("is-stuck"),
  ).toBe(true);
  // 実行: 表示する枠の下端を画面の上端から 80px の位置にする
  scrollBy(80 - viewport.clientHeight);
  // 検証
  await vi.waitFor(() =>
    expect(headsTransform(root)).toBe("translateY(340px)"),
  );
  window.scrollTo(0, 0);
});

// 全画面の中は表示する枠の上端だけに留める（正常系）
test("test_attach_diagrams_when_modal_heads", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createSequenceRoot();
  detachers.push(attachDiagrams({ root, placement: "bottom" }));
  button(root, "全画面で開く").click();
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  const modalViewport = viewportOf(dialog as HTMLDialogElement);
  // 全画面の全体が収まる倍率では縦に動かせないため、拡大してから動かす
  button(dialog as HTMLDialogElement, "拡大").click();
  button(dialog as HTMLDialogElement, "拡大").click();
  const stage = (dialog as HTMLDialogElement).querySelector<HTMLElement>(
    ".mdmark-diagram-stage",
  );
  const scale = Number(
    /scale\(([\d.]+)\)/.exec(stage?.style.transform ?? "")?.[1] ?? "1",
  );
  // 実行
  modalViewport.scrollTop = 120;
  modalViewport.dispatchEvent(new Event("scroll"));
  // 検証（図の座標に直した 120px）
  await vi.waitFor(() =>
    expect(
      Number(
        /translateY\(([\d.]+)px\)/.exec(
          headsTransform(dialog as HTMLDialogElement),
        )?.[1],
      ),
    ).toBeCloseTo(120 / scale, 2),
  );
});

// mermaid の図の文字の上のドラッグは図を動かさない（正常系）
test("test_attach_diagrams_when_mermaid_text_drag", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  root
    .querySelector("svg")
    ?.insertAdjacentHTML(
      "beforeend",
      '<text x="40" y="40" class="nodeLabel">受付</text>',
    );
  detachers.push(attachDiagrams({ root, placement: "top" }));
  button(root, "拡大").click();
  button(root, "拡大").click();
  const viewport = viewportOf(root);
  const text = root.querySelector("svg text") as SVGTextElement;
  const drag = (target: Element) => {
    const point = { bubbles: true, pointerId: 1, button: 0, clientY: 100 };
    target.dispatchEvent(
      new PointerEvent("pointerdown", { ...point, clientX: 300 }),
    );
    target.dispatchEvent(
      new PointerEvent("pointermove", { ...point, clientX: 220 }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", { ...point, clientX: 220 }),
    );
  };
  // 実行
  const before = viewport.scrollLeft;
  drag(text);
  const afterText = viewport.scrollLeft;
  drag(root.querySelector("svg rect") as Element);
  // 検証
  expect(afterText).toBe(before);
  expect(viewport.scrollLeft - afterText).toBe(80);
});

// 開閉のボタンでパネルを開き、もう一度押すと畳む（正常系）
test("test_attach_diagrams_when_panel_toggled", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const panel = root.querySelector<HTMLElement>(".mdmark-diagram-tools");
  const more = root.querySelector<HTMLButtonElement>(
    'button[data-tool="more"]',
  );
  if (!panel || !more) {
    throw new Error("パネルか開閉のボタンが無い");
  }
  // 実行
  more.click();
  // 検証
  expect(panel.hasAttribute("data-open")).toBe(true);
  expect(more.getAttribute("aria-expanded")).toBe("true");
  expect(more.getAttribute("aria-label")).toBe("表示の操作を閉じる");
  // 実行
  more.click();
  // 検証
  expect(panel.hasAttribute("data-open")).toBe(false);
  expect(more.getAttribute("aria-expanded")).toBe("false");
  expect(more.getAttribute("aria-label")).toBe("表示の操作を開く");
});

// id と、それを指す属性・矢じりと端の記号の参照を付け替える（正常系）
test("test_renumber_ids", async () => {
  // 準備
  const { renumberIds } = await loadDiagrams();
  const scope = document.createElement("div");
  scope.innerHTML = [
    '<svg><defs><marker id="map-1-head-0"></marker><marker id="map-1-head-0-from-circle"></marker></defs>',
    '<path marker-start="url(#map-1-head-0-from-circle)" marker-end="url(#map-1-head-0)"></path></svg>',
    '<span aria-describedby="map-1-tip-0"></span>',
  ].join("");
  // 実行
  renumberIds(scope, "map-1", "map-1-modal");
  // 検証
  expect(
    [...scope.querySelectorAll("marker")].map((marker) => marker.id),
  ).toEqual(["map-1-modal-head-0", "map-1-modal-head-0-from-circle"]);
  const path = scope.querySelector("path");
  expect(path?.getAttribute("marker-start")).toBe(
    "url(#map-1-modal-head-0-from-circle)",
  );
  expect(path?.getAttribute("marker-end")).toBe("url(#map-1-modal-head-0)");
  expect(scope.querySelector("span")?.getAttribute("aria-describedby")).toBe(
    "map-1-modal-tip-0",
  );
});
