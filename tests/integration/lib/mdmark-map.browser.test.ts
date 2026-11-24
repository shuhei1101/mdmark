import { afterEach, expect, inject, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { MdmarkNodeClickDetail } from "../../../src/index.ts";

/** map の図のカスタム要素のプロパティ */
type MapElement = HTMLElement & {
  source?: unknown;
  data?: unknown;
  options?: unknown;
};

/** ノード 3 つ（`api`・`db`・`ui`）と線 2 本の構成図 */
const SOURCE = "flowchart LR\n  ui[画面] --> api[API]\n  api --> db[(DB)]\n";

const placed: HTMLElement[] = [];
let built: Promise<unknown> | undefined;
let stylesheetLoaded: Promise<void> | undefined;

afterEach(() => {
  for (const element of placed.splice(0)) {
    element.remove();
  }
  window.getSelection()?.removeAllRanges();
  sessionStorage.clear();
});

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
const distUrl = (file: string): string =>
  `/@fs${inject("builtRoot")}/dist/${file}`;

/** ビルドした CSS と JS を 1 度だけ読み込み、部品のカスタム要素を登録した状態にする */
const loadBuilt = async (): Promise<void> => {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  await stylesheetLoaded;
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  await built;
};

/** 要素をページに配置し、後ろに文字 `後ろの段落` の `p` を続ける */
const place = <T extends HTMLElement>(element: T): T => {
  const wrapper = document.createElement("div");
  const after = document.createElement("p");
  after.className = "after";
  after.textContent = "後ろの段落";
  wrapper.append(element, after);
  document.body.append(wrapper);
  placed.push(wrapper);
  return element;
};

/** 図か通知ブロックを描き終えるまで待つ */
const settled = async (element: HTMLElement): Promise<void> => {
  await vi.waitFor(() =>
    expect(
      element.querySelector('figure.mdmark-diagram[data-diagram="map"]') ??
        element.querySelector(".mdmark-notice"),
    ).not.toBeNull(),
  );
};

/** 要素の中央をポインターで押す */
const press = (target: Element): void => {
  const box = target.getBoundingClientRect();
  const point = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  };
  target.dispatchEvent(new PointerEvent("pointerdown", point));
  window.dispatchEvent(new PointerEvent("pointerup", point));
  target.dispatchEvent(new MouseEvent("click", point));
};

/** 値が無ければ、無いものの名前で例外を投げる */
const must = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`${what}が無い`);
  }
  return value;
};

// Mermaid と補足から構成図を描き、ノードを押すとノードの ID を持つノードの押下のイベントを送信する（正常系）
test("test_normal", async () => {
  // 準備
  await loadBuilt();
  const element = place(document.createElement("mdmark-map") as MapElement);
  const ids: string[] = [];
  element.addEventListener("mdmark-node-click", (event) => {
    ids.push((event as CustomEvent<MdmarkNodeClickDetail>).detail.id);
  });
  element.source = SOURCE;
  element.data = { version: 1, notes: { api: { text: "認証を受け持つ" } } };
  element.options = { title: "全体の構成" };
  // 実行
  await settled(element);
  // 検証: 図の枠とノード・線
  const figure = must(
    element.querySelector('figure.mdmark-diagram[data-diagram="map"]'),
    "map の図",
  );
  expect(figure.querySelector(".mdmark-diagram-title")?.textContent).toContain(
    "全体の構成",
  );
  expect(
    figure.querySelectorAll(".mdmark-diagram-node[data-node]"),
  ).toHaveLength(3);
  expect(figure.querySelectorAll(".map-wire-hit[data-wire]")).toHaveLength(2);
  // 検証: api のノードにポインターを重ねると補足の説明のツールチップが出る
  const apiNode = must(
    figure.querySelector<HTMLElement>('.mdmark-diagram-node[data-node="api"]'),
    "api のノード",
  );
  await userEvent.hover(apiNode);
  const info = apiNode.querySelector<HTMLElement>(".mdmark-diagram-info");
  if (info) {
    await userEvent.hover(info);
  }
  await vi.waitFor(() =>
    expect(
      [...figure.querySelectorAll<HTMLElement>('[role="tooltip"]')].some(
        (tip) => !tip.hidden && tip.textContent?.includes("認証を受け持つ"),
      ),
    ).toBe(true),
  );
  // 実行: api のノードを押す
  const node = must(
    figure.querySelector('.mdmark-diagram-node[data-node="api"]'),
    "api のノード",
  );
  press(node);
  // 検証
  expect(ids).toEqual(["api"]);
  expect(node.hasAttribute("data-selected")).toBe(true);
  // 実行: フォーカスして Enter を押す
  must(
    figure.querySelector<HTMLElement>(
      '[data-node="api"] > .mdmark-diagram-node-hit',
    ),
    "api のノードの押せる要素",
  ).focus();
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(ids).toEqual(["api", "api"]);
  // 実行: 拡大・縮小のボタンと線を押す
  for (const tool of ["in", "out"]) {
    must(
      figure.querySelector<HTMLButtonElement>(`[data-tool="${tool}"]`),
      `${tool} のボタン`,
    ).click();
  }
  press(must(figure.querySelector('.map-wire-hit[data-wire="ui->api"]'), "線"));
  // 検証: 届かない
  expect(ids).toEqual(["api", "api"]);
});

// Mermaid を読み込めないか指定に誤りがあると、例外を投げずに通知ブロックを配置する（異常系）
test("test_error_when_data_invalid", async () => {
  // 準備
  await loadBuilt();
  const cases: Array<{ assign: (element: MapElement) => void; name: string }> =
    [
      {
        assign: (element) => {
          element.source = 'pie title 内訳\n  "A" : 1\n';
        },
        name: "source",
      },
      {
        assign: (element) => {
          element.source = SOURCE;
          element.options = { collapse: { open: false } };
        },
        name: "options.collapse",
      },
    ];
  for (const { assign, name } of cases) {
    const element = place(document.createElement("mdmark-map") as MapElement);
    // 実行
    expect(() => assign(element)).not.toThrow();
    await settled(element);
    // 検証
    const notice = element.querySelector(".mdmark-notice");
    expect(notice?.textContent).toContain("この図を表示できません");
    expect(notice?.innerHTML).toContain(`<code>${name}</code>`);
    expect(element.parentElement?.querySelector(".after")?.textContent).toBe(
      "後ろの段落",
    );
  }
});
