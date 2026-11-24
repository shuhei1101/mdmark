import { afterEach, expect, inject, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { MdmarkParamChangeDetail } from "../../../src/index.ts";

/** 操作できる部品のカスタム要素のプロパティ */
type ParamElement = HTMLElement & { definition?: unknown };

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

/** スライダー 1 つ（`rate`・0〜10・刻み 1・初期値 5）と、値ごとの点を持つ折れ線のグラフの定義 */
const rateDefinition = (): Record<string, unknown> => ({
  title: "反応の強さ",
  knob: { key: "rate", label: "強さ", min: 0, max: 10, step: 1, value: 5 },
  chart: {
    title: "強さごとの反応",
    scope: "経過 0〜2 秒",
    updated: "2026-11-24",
    x: { label: "経過（秒）", ticks: ["0", "1", "2"] },
    y: { label: "反応（%）", min: 0, max: 100, step: 25 },
  },
  table: Object.fromEntries(
    Array.from({ length: 11 }, (_, value) => [
      String(value),
      [0, value * 5, value * 10],
    ]),
  ),
});

/** 描いた <mdmark-param-graph> と、届いた値の変更の記録 */
const drawParam = async () => {
  await loadBuilt();
  const element = place(
    document.createElement("mdmark-param-graph") as ParamElement,
  );
  const changes: MdmarkParamChangeDetail[] = [];
  element.addEventListener("mdmark-param-change", (event) => {
    changes.push((event as CustomEvent<MdmarkParamChangeDetail>).detail);
  });
  element.definition = rateDefinition();
  await vi.waitFor(() =>
    expect(element.querySelector('input[type="range"]')).not.toBeNull(),
  );
  return { element, changes };
};

// 定義からスライダーとグラフを描き、スライダーを動かすとグラフを描き直して値の変更のイベントを送信する（正常系）
test("test_normal", async () => {
  // 準備
  const { element, changes } = await drawParam();
  const slider = element.querySelector<HTMLInputElement>('input[type="range"]');
  const stage = () =>
    element.querySelector(".mdmark-diagram-stage")?.innerHTML ?? "";
  // 検証: スライダー・今の値を写すボタン・グラフがあり、代入では送信しない
  expect(element.querySelector(".mdmark-param-copy")).not.toBeNull();
  expect(element.querySelector("figure.mdmark-diagram")).not.toBeNull();
  expect(changes).toEqual([]);
  const before = stage();
  // 実行: スライダーを 8 に動かす
  if (slider) {
    slider.value = "8";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // 検証
  expect(stage()).not.toBe(before);
  expect(changes).toEqual([{ key: "rate", value: 8 }]);
  // 実行: → キーで値を 1 つ変える
  slider?.focus();
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(changes).toHaveLength(2);
  expect(changes[1]).toEqual({ key: "rate", value: 9 });
});

// 定義が構造の確認に通らないと、例外を投げずに通知ブロックを配置する（異常系）
test("test_error_when_definition_invalid", async () => {
  // 準備
  await loadBuilt();
  const element = place(
    document.createElement("mdmark-param-graph") as ParamElement,
  );
  const definition = rateDefinition();
  const table = { ...(definition.table as Record<string, unknown>) };
  delete table["10"];
  // 実行
  expect(() => {
    element.definition = { ...definition, table };
  }).not.toThrow();
  // 検証
  await vi.waitFor(() =>
    expect(element.querySelector(".mdmark-notice")).not.toBeNull(),
  );
  expect(element.querySelector(".mdmark-notice")?.textContent).toContain(
    "この図を表示できません",
  );
  expect(element.parentElement?.querySelector(".after")?.textContent).toBe(
    "後ろの段落",
  );
});
