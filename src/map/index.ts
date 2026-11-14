import type { ResolvedConfig } from "../config.ts";
import { renderSyntaxWarning } from "../parts/syntax-warning.ts";
import { collectMapProblems } from "./check.ts";
import { attachMapEr } from "./er-view.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import { parseFlowchart } from "./flowchart.ts";
import { parseSequence } from "./sequence.ts";
import { attachMapSequence } from "./sequence-view.ts";
import { parseMapArgs } from "./spec.ts";
import { attachMapState } from "./state-view.ts";
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
    range: HTMLElement;
    playsOver: number | undefined;
    source: string;
    attach: (
      onStep: (message: number | undefined) => void,
      follow: { start: () => void; step: (message: number) => void },
    ) => void;
    /** 構成図の上を強調しているか */
    driving: boolean;
    clear: () => void;
  }> = [];
  /** 構成図の番号から、その構成図のノードの ID */
  const flowIds = new Map<number, Set<string>>();
  for (const range of root.querySelectorAll<HTMLElement>("div.mdmark-map")) {
    const source = sourceOf(range);
    const structure = collectMapStructure(source);
    const known = new Set(structure.problems.map((item) => item.message));
    // render が定義のある注記の ID を入れた範囲だけ、定義の無い注記の参照を確かめる
    const annotations = range.dataset.mapAnnotations;
    addWarnings(
      range,
      collectMapProblems(
        source,
        config.map,
        false,
        annotations === undefined
          ? undefined
          : new Set(Object.keys(JSON.parse(annotations) as object)),
      )
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
      const entry: (typeof sequences)[number] = {
        range,
        playsOver: undefined,
        source: mermaid,
        driving: false,
        clear: () => {},
        attach: (onStep, follow) => {
          const handle = attachMapSequence(range, config, args, onStep, follow);
          destroyers.push(handle.destroy);
          entry.playsOver = handle.playsOver;
          entry.clear = handle.clear;
        },
      };
      sequences.push(entry);
    } else if (range.dataset.mapKind === "erDiagram") {
      destroyers.push(attachMapEr(range, config, args).destroy);
    } else if (range.dataset.mapKind === "stateDiagram") {
      destroyers.push(attachMapState(range, config, args).destroy);
    } else {
      // 構成図の案内を始めたら、この構成図の上で再生しているシーケンス図の強調を解く（構成図の強調は残す）
      const handle = attachMapFlow(range, config, args, () => {
        for (const entry of sequences) {
          if (entry.playsOver !== number || !entry.driving) continue;
          entry.driving = false;
          entry.clear();
        }
      });
      flows.set(number, handle);
      flowIds.set(
        number,
        new Set(
          parseFlowchart(source.mermaid ?? "").nodes.map((node) => node.id),
        ),
      );
      destroyers.push(handle.destroy);
    }
  }
  // シーケンス図の再生で進めたメッセージを、plays_over で指した構成図の上でも強調する
  for (const entry of sequences) {
    const sequence = parseSequence(entry.source);
    let target: MapFlowHandle | undefined;
    let missing = new Set<string>();
    /** plays_over で指した構成図（構成図を付け終えた後に引く） */
    const targetOf = () => {
      target ??=
        entry.playsOver === undefined ? undefined : flows.get(entry.playsOver);
      return target;
    };
    entry.attach(
      (message) => {
        const flow = targetOf();
        if (!flow) return;
        const item =
          message === undefined ? undefined : sequence.messages[message];
        // 構成図に無い相手のメッセージでは、構成図の強調を解く
        if (
          item === undefined ||
          missing.has(item.from) ||
          missing.has(item.to)
        ) {
          if (entry.driving) flow.clearFocus();
          entry.driving = false;
        } else {
          entry.driving = true;
          flow.focus({ nodes: [item.from, item.to], wires: [] });
        }
      },
      // 自動で進めている間は、構成図の図の枠の中も送り手と受け手のノードへスクロールする（構成図に無い相手のメッセージは除く）
      {
        start: () => targetOf()?.resumeFollow(),
        step: (message) => {
          const item = sequence.messages[message];
          if (
            item === undefined ||
            missing.has(item.from) ||
            missing.has(item.to)
          )
            return;
          targetOf()?.follow([item.from, item.to]);
        },
      },
    );
    // plays_over で指した構成図に無い参加者を、シーケンス図の前の書き方の警告にする
    const ids =
      entry.playsOver === undefined ? undefined : flowIds.get(entry.playsOver);
    if (ids !== undefined) {
      missing = new Set(
        sequence.participants
          .map((item) => item.id)
          .filter((id) => !ids.has(id)),
      );
      if (missing.size > 0)
        addWarnings(entry.range, [
          `構成図に無い相手 ${[...missing].map((id) => `\`${id}\``).join("・")} のメッセージは、構成図の上では強調しません。構成図のノードの ID にそろえてください。`,
        ]);
    }
  }
  return () => {
    for (const destroy of destroyers.splice(0)) destroy();
  };
};
