import type { ResolvedConfig } from "../config.ts";
import { renderSyntaxWarning } from "../parts/syntax-warning.ts";
import { collectMapProblems } from "./check.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import { parseSequence } from "./sequence.ts";
import { attachMapSequence } from "./sequence-view.ts";
import { parseMapArgs } from "./spec.ts";
import { collectMapStructure, type MapRangeSource } from "./structure.ts";

export { attachMapFlow } from "./flow-view.ts";
export { attachMapSequence } from "./sequence-view.ts";

/** 範囲の要素から、点検に渡す範囲の中身を取り出す */
const sourceOf = (range: HTMLElement): MapRangeSource => {
  const data =
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined;
  return {
    args: range.dataset.mapArgs ?? "",
    mermaid: range.querySelector("code")?.textContent ?? "",
    mermaidCount: 1,
    data,
    dataCount: data === undefined ? 0 : 1,
  };
};

/** 範囲の前に記載の警告を足す。render が配置した警告があれば、その一覧に項目を足す */
const addWarnings = (range: HTMLElement, messages: string[]): void => {
  if (messages.length === 0) return;
  const before = range.previousElementSibling;
  if (before?.classList.contains("mdmark-syntax-warning")) {
    let list = before.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      before.append(list);
    }
    for (const message of messages) {
      const item = document.createElement("li");
      item.textContent = message;
      list.append(item);
    }
    return;
  }
  range.insertAdjacentHTML(
    "beforebegin",
    renderSyntaxWarning({
      mark: "map",
      message: "の範囲の書き方に誤りがあります。読めた分で描いています。",
      items: messages.map((message) => ({ label: "", message })),
    }),
  );
};

/** `root` の中の `div.mdmark-map` ごとに、種類で構成図かシーケンス図を付け、案内と再生をつなぎ、片付ける関数を返す */
export const attachMap = (
  root: HTMLElement,
  config: ResolvedConfig,
): (() => void) => {
  const destroyers: Array<() => void> = [];
  const flows = new Map<number, MapFlowHandle>();
  const sequences: Array<{
    playsOver: number | undefined;
    source: string;
    attach: (onStep: (message: number | undefined) => void) => void;
  }> = [];
  for (const range of root.querySelectorAll<HTMLElement>("div.mdmark-map")) {
    const source = sourceOf(range);
    const structure = collectMapStructure(source);
    const known = new Set(structure.problems.map((item) => item.message));
    addWarnings(
      range,
      collectMapProblems(source, config.map, false)
        .filter((item) => !known.has(item.message))
        .map((item) => item.message),
    );
    const { args } = parseMapArgs(range.dataset.mapArgs ?? "");
    if (args.collapse !== undefined) {
      const details = document.createElement("details");
      details.className = "map-collapse";
      if (args.collapse.open !== false) details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = args.collapse.title ?? args.title ?? "";
      range.before(details);
      details.append(summary, range);
    }
    const number = Number(range.dataset.map ?? "0");
    if (range.dataset.mapKind === "sequenceDiagram") {
      const mermaid = source.mermaid ?? "";
      sequences.push({
        playsOver: undefined,
        source: mermaid,
        attach: (onStep) => {
          const handle = attachMapSequence(range, config, args, onStep);
          destroyers.push(handle.destroy);
          const entry = sequences.find((item) => item.source === mermaid);
          if (entry) entry.playsOver = handle.playsOver;
        },
      });
    } else {
      const handle = attachMapFlow(range, config, args);
      flows.set(number, handle);
      destroyers.push(handle.destroy);
    }
  }
  // シーケンス図の再生で進めたメッセージを、plays_over で指した構成図の上でも強調する
  for (const entry of sequences) {
    const sequence = parseSequence(entry.source);
    let target: MapFlowHandle | undefined;
    entry.attach((message) => {
      target ??=
        entry.playsOver === undefined ? undefined : flows.get(entry.playsOver);
      if (!target) return;
      const item =
        message === undefined ? undefined : sequence.messages[message];
      if (item === undefined) target.clearFocus();
      else target.focus({ nodes: [item.from, item.to], wires: [] });
    });
  }
  return () => {
    for (const destroy of destroyers.splice(0)) destroy();
  };
};
