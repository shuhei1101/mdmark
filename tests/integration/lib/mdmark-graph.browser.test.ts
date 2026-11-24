import { afterEach, expect, inject, test, vi } from "vitest";

/** グラフのカスタム要素のプロパティ */
type GraphElement = HTMLElement & { definition?: unknown };

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

/** 折れ線・系列 1 つ・項目 `count` 個のグラフの定義（タイトルは HTML の文字） */
const lineDefinition = (count: number): Record<string, unknown> => ({
  type: "line",
  title: "<script>alert(1)</script>推移",
  scope: "Sprint 1〜6",
  updated: "2026-11-24",
  x: {
    label: "Sprint",
    ticks: Array.from({ length: count }, (_, index) => String(index + 1)),
  },
  y: { label: "pt" },
  series: [
    {
      name: "pt",
      points: Array.from({ length: count }, (_, index) => index + 2),
    },
  ],
});

/** 折れ線の点の数 */
const pointCount = (element: HTMLElement): number =>
  element.querySelectorAll(
    ".mdmark-diagram-stage [data-point], .mdmark-diagram-stage circle",
  ).length;

// 定義から図の枠とグラフを描き、定義を指定し直すと描き直す（正常系）
test("test_normal", async () => {
  // 準備
  await loadBuilt();
  const element = place(document.createElement("mdmark-graph") as GraphElement);
  // 実行
  element.definition = lineDefinition(5);
  await vi.waitFor(() =>
    expect(element.querySelector("figure.mdmark-diagram")).not.toBeNull(),
  );
  // 検証: 図の枠（タイトル・表示する枠・凡例・ボタンのパネル）と 5 つの点
  const figure = element.querySelector("figure.mdmark-diagram");
  expect(element.querySelectorAll(":scope > .mdmark")).toHaveLength(1);
  expect(figure?.querySelector(".mdmark-diagram-title")?.textContent).toContain(
    "<script>alert(1)</script>推移",
  );
  expect(element.querySelector("script")).toBeNull();
  expect(figure?.querySelector(".mdmark-diagram-viewport")).not.toBeNull();
  expect(figure?.querySelector(".mdmark-diagram-legend")).not.toBeNull();
  expect(figure?.querySelector(".mdmark-diagram-tools")).not.toBeNull();
  const fivePoints = pointCount(element);
  expect(fivePoints).toBeGreaterThanOrEqual(5);
  // 実行: 項目を 6 つにした定義を指定し直す
  element.definition = lineDefinition(6);
  await vi.waitFor(() =>
    expect(pointCount(element)).toBeGreaterThan(fivePoints),
  );
  // 検証: 図の枠は 1 つのまま
  expect(element.querySelectorAll("figure.mdmark-diagram")).toHaveLength(1);
});

// 定義が構造の確認に通らないと、例外を投げずに通知ブロックを配置する（異常系）
test("test_error_when_definition_invalid", async () => {
  // 準備
  await loadBuilt();
  const { title: _title, ...withoutTitle } = lineDefinition(3);
  const cases: unknown[] = [
    { ...lineDefinition(3), type: "area3d" },
    withoutTitle,
  ];
  for (const definition of cases) {
    const element = place(
      document.createElement("mdmark-graph") as GraphElement,
    );
    // 実行
    expect(() => {
      element.definition = definition;
    }).not.toThrow();
    // 検証
    await vi.waitFor(() =>
      expect(element.querySelector(".mdmark-notice")).not.toBeNull(),
    );
    const notice = element.querySelector(".mdmark-notice");
    expect(notice?.textContent).toContain("この図を表示できません");
    expect(notice?.innerHTML).toContain("<code>definition</code>");
    expect(element.parentElement?.querySelector(".after")?.textContent).toBe(
      "後ろの段落",
    );
  }
});
