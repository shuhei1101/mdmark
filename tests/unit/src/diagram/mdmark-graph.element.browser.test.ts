import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  parsed,
  REPLY_TIME_TEXT,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../helpers/diagrams.ts";
import { addStyles } from "../../helpers/dom.ts";
import { loadSource } from "../../helpers/lazy.ts";
import { renderDoc } from "../../helpers/render.ts";

/** グラフと操作できる部品のカスタム要素を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadElement = () =>
  loadSource(
    import.meta.glob<
      typeof import("../../../../src/diagram/mdmark-graph.element.ts")
    >("../../../../src/diagram/mdmark-graph.element.ts"),
  );

const elements: HTMLElement[] = [];

beforeAll(async () => {
  addStyles();
  const { defineGraphElements } = await loadElement().catch(() => ({
    defineGraphElements: undefined,
  }));
  defineGraphElements?.(customElements);
});

afterEach(() => {
  for (const element of elements.splice(0)) {
    element.remove();
  }
});

/** 型 MdmarkGraphElement・MdmarkParamGraphElement のプロパティを持つ要素 */
type GraphElement = HTMLElement & { definition?: unknown };

/** ページに配置した要素 */
function createElement(name: "mdmark-graph" | "mdmark-param-graph") {
  const element = document.createElement(name) as GraphElement;
  document.body.append(element);
  elements.push(element);
  return element;
}

/** 描き終えるまで待つ */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

/** 見本の操作できる部品の定義のスライダーのキーを `rate` にしたもの */
function rateDefinition(): Record<string, unknown> {
  const definition = parsed<Record<string, unknown>>(STRENGTH_TEXT);
  return {
    ...definition,
    knob: { ...(definition.knob as Record<string, unknown>), key: "rate" },
  };
}

/** 図の枠の中の SVG の要素の名前を並べる（ID の振り直しに左右されない比べ方） */
function svgShape(root: ParentNode): string[] {
  return [...root.querySelectorAll("figure.mdmark-diagram svg *")].map(
    (node) => node.tagName,
  );
}

// 定義から図の枠とグラフを描く（正常系）
test("test_render_now", async () => {
  // 準備
  await loadElement();
  const element = createElement("mdmark-graph");
  const expected = document.createElement("div");
  expected.innerHTML = renderDoc(wrapDirective("chart", REPLY_TIME_TEXT)).html;
  // 実行
  element.definition = parsed(REPLY_TIME_TEXT);
  await flush();
  // 検証
  expect(element.firstElementChild?.classList.contains("mdmark")).toBe(true);
  expect(element.querySelectorAll("figure.mdmark-diagram")).toHaveLength(1);
  expect(svgShape(element)).toEqual(svgShape(expected));
});

// 定義を代入し直すと、図の枠の倍率を保って描き直す（正常系）
test("test_render_now_when_redrawn", async () => {
  // 準備
  await loadElement();
  const element = createElement("mdmark-graph");
  const definition = parsed<Record<string, unknown>>(REPLY_TIME_TEXT);
  element.definition = definition;
  await flush();
  const zoomIn = () =>
    element.querySelector<HTMLButtonElement>('[data-tool="in"]')?.click();
  zoomIn();
  zoomIn();
  const zoomText = () =>
    element.querySelector('[data-tool="fit"]')?.textContent ?? "";
  const before = zoomText();
  // 実行
  element.definition = { ...definition, updated: "2026-11-25" };
  await flush();
  // 検証
  expect(before).not.toBe("100%");
  expect(zoomText()).toBe(before);
});

// 誤った定義は通知ブロックを描く（異常系）
test("test_render_now_when_invalid", async () => {
  // 準備
  await loadElement();
  const element = createElement("mdmark-graph");
  const { title: _title, ...withoutTitle } =
    parsed<Record<string, unknown>>(REPLY_TIME_TEXT);
  // 実行
  const assign = () => {
    element.definition = withoutTitle;
  };
  expect(assign).not.toThrow();
  await flush();
  // 検証
  const notice = element.querySelector(".mdmark-notice");
  expect(notice?.innerHTML).toContain("この図を表示できません");
  expect(element.querySelector("figure.mdmark-diagram svg")).toBeNull();
});

// スライダーの値の変更を送信する（正常系）
test("test_render_now_when_param_changed", async () => {
  // 準備
  await loadElement();
  const element = createElement("mdmark-param-graph");
  const changes = vi.fn();
  element.addEventListener("mdmark-param-change", (event) =>
    changes((event as CustomEvent).detail),
  );
  element.definition = rateDefinition();
  await flush();
  const assignedChanges = changes.mock.calls.length;
  const slider = element.querySelector<HTMLInputElement>('input[type="range"]');
  // 実行
  if (slider) {
    slider.value = "8";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // 検証
  expect(assignedChanges).toBe(0);
  expect(changes).toHaveBeenCalledTimes(1);
  expect(changes).toHaveBeenCalledWith({ key: "rate", value: 8 });
});

// 未登録の名前だけ登録する（正常系）
test("test_define_graph_elements", async () => {
  // 準備
  const { defineGraphElements, MdmarkParamGraphElement } = await loadElement();
  const define = vi.fn();
  const registry = {
    get: vi.fn((name: string) =>
      name === "mdmark-graph" ? class extends HTMLElement {} : undefined,
    ),
    define,
  } as unknown as CustomElementRegistry;
  // 実行
  defineGraphElements(registry);
  // 検証
  expect(define).toHaveBeenCalledTimes(1);
  expect(define).toHaveBeenCalledWith(
    "mdmark-param-graph",
    MdmarkParamGraphElement,
  );
});
