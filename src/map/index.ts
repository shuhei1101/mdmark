import type { ResolvedConfig } from "../config.ts";
import { renderSyntaxWarning } from "../parts/syntax-warning.ts";
import { collectMapProblems } from "./check.ts";
import { attachMapEr } from "./er-view.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import { parseFlowchart } from "./flowchart.ts";
import { parseSequence, type SequenceMessage } from "./sequence.ts";
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

/** 再生を構成図の上でも強調するシーケンス図 */
type SequenceEntry = {
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
};

/** 範囲を付けるときに集める値 */
type AttachContext = {
  config: ResolvedConfig;
  destroyers: Array<() => void>;
  flows: Map<number, MapFlowHandle>;
  sequences: SequenceEntry[];
  /** 構成図の番号から、その構成図のノードの ID */
  flowIds: Map<number, Set<string>>;
};

/** マーカーの引数 */
type MapArgs = ReturnType<typeof parseMapArgs>["args"];

/** 範囲の書き方の誤りを、範囲の前の警告にする（render が出した誤りは除く） */
const warnRange = (
  range: HTMLElement,
  context: { source: MapRangeSource; config: ResolvedConfig },
): void => {
  const { source, config } = context;
  const structure = collectMapStructure(source);
  const known = new Set(structure.problems.map((item) => item.message));
  // render が定義のある注記の ID を入れた範囲だけ、定義の無い注記の参照を確かめる
  const annotations = range.dataset.mapAnnotations;
  addWarnings(
    range,
    collectMapProblems(
      {
        ...source,
        annotationIds:
          annotations === undefined
            ? undefined
            : new Set(Object.keys(JSON.parse(annotations) as object)),
      },
      config.map,
      false,
    )
      .filter((item) => !known.has(item.message))
      .map((item) => item.message),
  );
};

/** `collapse` の引数を持つ範囲を `details` で包む */
const collapseRange = (range: HTMLElement, args: MapArgs): void => {
  if (args.collapse === undefined) return;
  const details = document.createElement("details");
  details.className = "map-collapse";
  if (args.collapse.open !== false) details.open = true;
  const summary = document.createElement("summary");
  summary.textContent = args.collapse.title ?? args.title ?? "";
  range.before(details);
  details.append(summary, range);
};

/** 範囲 1 つに、種類の図を付ける。シーケンス図は構成図を付け終えた後に付ける */
const attachRange = (context: AttachContext, range: HTMLElement): void => {
  const { config, destroyers } = context;
  const source = sourceOf(range);
  warnRange(range, { source, config });
  const { args } = parseMapArgs(range.dataset.mapArgs ?? "");
  collapseRange(range, args);
  const kind = range.dataset.mapKind;
  if (kind === "sequenceDiagram") {
    context.sequences.push(sequenceEntry(context, { range, args, source }));
  } else if (kind === "erDiagram") {
    destroyers.push(attachMapEr(range, config, args).destroy);
  } else if (kind === "stateDiagram") {
    destroyers.push(attachMapState(range, config, args).destroy);
  } else {
    attachFlowRange(context, { range, args, source });
  }
};

/** シーケンス図の範囲を、構成図を付け終えた後に付ける項目にする */
const sequenceEntry = (
  context: AttachContext,
  target: { range: HTMLElement; args: MapArgs; source: MapRangeSource },
): SequenceEntry => {
  const { range, args, source } = target;
  const entry: SequenceEntry = {
    range,
    playsOver: undefined,
    source: source.mermaid ?? "",
    driving: false,
    clear: () => {},
    attach: (onStep, follow) => {
      const handle = attachMapSequence(range, context.config, {
        args,
        onStep,
        follow,
      });
      context.destroyers.push(handle.destroy);
      entry.playsOver = handle.playsOver;
      entry.clear = handle.clear;
    },
  };
  return entry;
};

/** 構成図の範囲を付け、番号で引けるようにする */
const attachFlowRange = (
  context: AttachContext,
  target: { range: HTMLElement; args: MapArgs; source: MapRangeSource },
): void => {
  const { range, args, source } = target;
  const number = Number(range.dataset.map ?? "0");
  // 構成図の案内を始めたら、この構成図の上で再生しているシーケンス図の強調を解く（構成図の強調は残す）
  const handle = attachMapFlow(range, context.config, {
    args,
    onWalk: () => {
      for (const entry of context.sequences) {
        if (entry.playsOver !== number || !entry.driving) continue;
        entry.driving = false;
        entry.clear();
      }
    },
  });
  context.flows.set(number, handle);
  context.flowIds.set(
    number,
    new Set(parseFlowchart(source.mermaid ?? "").nodes.map((node) => node.id)),
  );
  context.destroyers.push(handle.destroy);
};

/** シーケンス図の再生で進めたメッセージを、plays_over で指した構成図の上でも強調する */
const linkSequence = (context: AttachContext, entry: SequenceEntry): void => {
  const sequence = parseSequence(entry.source);
  let target: MapFlowHandle | undefined;
  let missing = new Set<string>();
  /** plays_over で指した構成図（構成図を付け終えた後に引く） */
  const targetOf = () => {
    target ??=
      entry.playsOver === undefined
        ? undefined
        : context.flows.get(entry.playsOver);
    return target;
  };
  /** 構成図に無い相手のメッセージか */
  const outside = (item: SequenceMessage): boolean =>
    missing.has(item.from) || missing.has(item.to);
  entry.attach(
    (message) => {
      const flow = targetOf();
      if (!flow) return;
      const item =
        message === undefined ? undefined : sequence.messages[message];
      // 構成図に無い相手のメッセージでは、構成図の強調を解く
      if (item === undefined || outside(item)) {
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
        if (item === undefined || outside(item)) return;
        targetOf()?.follow([item.from, item.to]);
      },
    },
  );
  // plays_over で指した構成図に無い参加者を、シーケンス図の前の書き方の警告にする
  const ids =
    entry.playsOver === undefined
      ? undefined
      : context.flowIds.get(entry.playsOver);
  if (ids === undefined) return;
  missing = new Set(
    sequence.participants.map((item) => item.id).filter((id) => !ids.has(id)),
  );
  if (missing.size > 0)
    addWarnings(entry.range, [
      `構成図に無い相手 ${[...missing].map((id) => `\`${id}\``).join("・")} のメッセージは、構成図の上では強調しません。構成図のノードの ID にそろえてください。`,
    ]);
};

/** `root` の中の `div.mdmark-map` ごとに、種類で構成図かシーケンス図を付け、案内と再生をつなぎ、片付ける関数を返す */
export const attachMap = (
  root: HTMLElement,
  config: ResolvedConfig,
): (() => void) => {
  const context: AttachContext = {
    config,
    destroyers: [],
    flows: new Map(),
    sequences: [],
    flowIds: new Map(),
  };
  for (const range of root.querySelectorAll<HTMLElement>("div.mdmark-map"))
    attachRange(context, range);
  for (const entry of context.sequences) linkSequence(context, entry);
  return () => {
    for (const destroy of context.destroyers.splice(0)) destroy();
  };
};
