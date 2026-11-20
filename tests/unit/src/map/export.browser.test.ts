import { afterEach, expect, test, vi } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { CONFIG, DATA, FLOW, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** 図の書き出しを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadExport = () => import("../../../../src/map/export.ts");
const loadFlowView = () => import("../../../../src/map/flow-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];
const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) detach();
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

/** 構成図を描いて付け、範囲と stage を返す */
async function setUp(data = DATA, args = '{"title": "全体の構成"}') {
  addStyles();
  const { attachMapFlow } = await loadFlowView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ args, mermaid: FLOW, data })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapFlow(range, resolveConfig({ config: { map: CONFIG } }), {
      args: parseMapArgs(args).args,
    }),
  );
  const stage = range.querySelector<HTMLElement>(
    ".mdmark-diagram-stage",
  ) as HTMLElement;
  return { root, range, stage };
}

/** 保存の `a` の `click` を受け取り、押された `download` を記録する */
const captureDownloads = (): string[] => {
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return names;
};

/** 条件が満たされるまで待つ */
const waitFor = async (check: () => boolean): Promise<void> => {
  for (let i = 0; i < 100 && !check(); i += 1)
    await new Promise((resolve) => setTimeout(resolve, 20));
};

// タイトルと拡張子（正常系）
test("test_map_export_file_name", async () => {
  // 準備
  const { mapExportFileName } = await loadExport();
  // 実行・検証
  expect(
    mapExportFileName({ title: "全体の構成", index: 1, format: "png" }),
  ).toBe("全体の構成.png");
});

// タイトルが無い（正常系）
test("test_map_export_file_name_when_no_title", async () => {
  // 準備
  const { mapExportFileName } = await loadExport();
  // 実行・検証
  expect(mapExportFileName({ title: undefined, index: 2, format: "svg" })).toBe(
    "図 2.svg",
  );
});

// 使用できない文字（正常系）
test("test_map_export_file_name_when_forbidden_chars", async () => {
  // 準備
  const { mapExportFileName } = await loadExport();
  // 実行・検証
  expect(mapExportFileName({ title: "a/b:c?", index: 1, format: "svg" })).toBe(
    "a_b_c_.svg",
  );
});

// 外部の資源を持たない SVG（正常系）
test("test_export_map_svg", async () => {
  // 準備
  const { exportMapSvg } = await loadExport();
  const { root, stage } = await setUp();
  root
    .querySelector<HTMLButtonElement>('button[aria-label="データを閉じる"]')
    ?.click();
  root
    .querySelector<HTMLElement>('[data-node="mount"] .mdmark-diagram-node-hit')
    ?.click();
  const width = stage.offsetWidth;
  const height = stage.offsetHeight;
  root.querySelector<HTMLButtonElement>('button[aria-label="拡大"]')?.click();
  const fresh = root.querySelector<HTMLElement>(
    ".mdmark-diagram-stage",
  ) as HTMLElement;
  // 実行
  const image = exportMapSvg(fresh);
  // 検証
  expect(image.width).toBe(width);
  expect(image.height).toBe(height);
  expect(image.svg).toContain(`width="${width}"`);
  expect(image.svg).toContain(`height="${height}"`);
  expect(image.svg).not.toMatch(/href="https?:/);
  expect(image.svg).not.toMatch(/url\(\s*["']?(?!#)/);
  expect(image.svg).not.toContain("var(");
  expect(image.svg).not.toContain("class=");
  expect(image.svg).not.toContain("data-selected");
  expect(image.svg).toContain("データ");
  expect(image.svg).not.toContain("文書の Markdown");
  expect(root.querySelectorAll("iframe")).toHaveLength(0);
});

// 疑似要素で描いた表示（正常系）
test("test_export_map_svg_when_pseudo_element", async () => {
  // 準備
  const { exportMapSvg } = await loadExport();
  const { stage } = await setUp();
  const style = document.createElement("style");
  style.textContent = '.map740-after::after { content: "あと"; }';
  document.head.append(style);
  const node = stage.querySelector<HTMLElement>(".mdmark-diagram-node-name");
  node?.classList.add("map740-after");
  // 実行
  const image = exportMapSvg(stage);
  style.remove();
  // 検証
  expect(image.svg).toMatch(/<span[^>]*>あと<\/span>/);
});

// 継承する色を親と比べる（正常系）
test("test_export_map_svg_when_inherited_color", async () => {
  // 準備
  const { exportMapSvg } = await loadExport();
  const { stage } = await setUp();
  const node = stage.querySelector<HTMLElement>(
    '.mdmark-diagram-node[data-node="user"]',
  ) as HTMLElement;
  const name = node.querySelector<HTMLElement>(
    ".mdmark-diagram-node-name",
  ) as HTMLElement;
  const kind = node.querySelector<HTMLElement>(
    ".mdmark-diagram-node-kind",
  ) as HTMLElement;
  const nameColor = getComputedStyle(name).color;
  const kindColor = getComputedStyle(kind).color;
  // 実行
  const image = exportMapSvg(stage);
  const holder = document.createElement("div");
  holder.innerHTML = image.svg;
  document.body.append(holder);
  const copied = holder.querySelectorAll<HTMLElement>("foreignObject *");
  const names = [...copied].filter(
    (element) =>
      element.textContent === name.textContent && element.children.length === 0,
  );
  const kinds = [...copied].filter(
    (element) =>
      element.textContent === kind.textContent && element.children.length === 0,
  );
  // 検証
  expect(names.length).toBeGreaterThan(0);
  expect(getComputedStyle(names[0] as HTMLElement).color).toBe(nameColor);
  expect(getComputedStyle(kinds[0] as HTMLElement).color).toBe(kindColor);
  expect(document.querySelectorAll("iframe")).toHaveLength(0);
  holder.remove();
});

// 2 倍の PNG（正常系）
test("test_export_map_png", async () => {
  // 準備
  const { exportMapPng } = await loadExport();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#fff"/></svg>';
  // 実行
  const blob = await exportMapPng({ svg, width: 300, height: 200 });
  // 検証
  expect(blob?.type).toBe("image/png");
  const bitmap = await createImageBitmap(blob as Blob);
  expect([bitmap.width, bitmap.height]).toEqual([600, 400]);
});

// toBlob が null を渡す（異常系）
test("test_export_map_png_when_to_blob_null", async () => {
  // 準備
  const { exportMapPng } = await loadExport();
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => callback(null),
  );
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"></svg>';
  // 実行
  const blob = await exportMapPng({ svg, width: 300, height: 200 });
  // 検証
  expect(blob).toBeNull();
});

// 開閉と SVG の保存（正常系）
test("test_attach_map_export", async () => {
  // 準備
  const { attachMapExport } = await loadExport();
  const { range } = await setUp();
  const downloads = captureDownloads();
  detachers.push(
    attachMapExport(range, { index: 1, title: () => "全体の構成" }),
  );
  const button = range.querySelector<HTMLButtonElement>(
    '[data-tool="export"]',
  ) as HTMLButtonElement;
  // 実行
  button.click();
  const opened = button.getAttribute("aria-expanded");
  range.querySelector<HTMLButtonElement>('[data-export="svg"]')?.click();
  await waitFor(() => downloads.length > 0);
  // 検証
  expect(opened).toBe("true");
  expect(downloads).toEqual(["全体の構成.svg"]);
  expect(
    range.querySelector<HTMLElement>(".mdmark-diagram-export")?.hidden,
  ).toBe(true);
});

// Esc で閉じる（正常系）
test("test_attach_map_export_when_escape", async () => {
  // 準備
  const { attachMapExport } = await loadExport();
  const { range } = await setUp();
  detachers.push(
    attachMapExport(range, { index: 1, title: () => "全体の構成" }),
  );
  const button = range.querySelector<HTMLButtonElement>(
    '[data-tool="export"]',
  ) as HTMLButtonElement;
  button.click();
  const svg = range.querySelector<HTMLButtonElement>(
    '[data-export="svg"]',
  ) as HTMLButtonElement;
  svg.focus();
  // 実行
  svg.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  // 検証
  expect(
    range.querySelector<HTMLElement>(".mdmark-diagram-export")?.hidden,
  ).toBe(true);
  expect(document.activeElement).toBe(button);
});

// PNG にできない（異常系）
test("test_attach_map_export_when_png_unavailable", async () => {
  // 準備
  const { attachMapExport } = await loadExport();
  const { range } = await setUp();
  const downloads = captureDownloads();
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => callback(null),
  );
  detachers.push(
    attachMapExport(range, { index: 1, title: () => "全体の構成" }),
  );
  range.querySelector<HTMLButtonElement>('[data-tool="export"]')?.click();
  const status = () =>
    range.querySelector<HTMLElement>('.mdmark-diagram-export [role="status"]')
      ?.textContent ?? "";
  // 実行
  range.querySelector<HTMLButtonElement>('[data-export="png"]')?.click();
  await waitFor(() => status() !== "");
  // 検証
  expect(downloads).toEqual([]);
  expect(
    range.querySelector<HTMLElement>(".mdmark-diagram-export")?.hidden,
  ).toBe(false);
  expect(status()).toBe(
    "この大きさの図は PNG にできません。SVG で書き出してください。",
  );
});
