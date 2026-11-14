import { decodeEntities } from "./flowchart.ts";
import type { MapProblem } from "./spec.ts";

/** メッセージの矢印の記法 */
export type SequenceArrowName =
  | "->"
  | "-->"
  | "->>"
  | "-->>"
  | "-x"
  | "--x"
  | "-)"
  | "--)"
  | "<<->>"
  | "<<-->>";

/** 矢印の見た目: 実線か点線と、矢じり（無し・塗り・×・非同期の開いた矢じり）と、両向きか */
export type SequenceArrowStyle = {
  dotted: boolean;
  head: "none" | "filled" | "cross" | "async";
  both: boolean;
};

/** 矢印の記法ごとの見た目。長い記法から順に照らす */
export const SEQ_ARROW_STYLES: Record<SequenceArrowName, SequenceArrowStyle> = {
  "<<-->>": { dotted: true, head: "filled", both: true },
  "<<->>": { dotted: false, head: "filled", both: true },
  "-->>": { dotted: true, head: "filled", both: false },
  "->>": { dotted: false, head: "filled", both: false },
  "--x": { dotted: true, head: "cross", both: false },
  "-x": { dotted: false, head: "cross", both: false },
  "--)": { dotted: true, head: "async", both: false },
  "-)": { dotted: false, head: "async", both: false },
  "-->": { dotted: true, head: "none", both: false },
  "->": { dotted: false, head: "none", both: false },
};

export type SequenceParticipant = { id: string; label: string; actor: boolean };

export type SequenceMessage = {
  from: string;
  to: string;
  text: string;
  arrow: SequenceArrowName;
  /** 受け手を活性化する（+）・送り手の活性化を終える（-） */
  activation: "+" | "-" | undefined;
};

/** 複合フラグメントと rect。sections は else・and・option で分けた区間 */
export type SequenceFragment = {
  kind: "loop" | "alt" | "opt" | "par" | "critical" | "break" | "rect";
  label: string;
  depth: number;
  /** 区間ごとの、始まりのメッセージの番号（0 から）とラベル */
  sections: Array<{ start: number; label: string }>;
  start: number;
  /** 終わりのメッセージの番号（含まない） */
  end: number;
};

/** 注記。after はその前にあるメッセージの数 */
export type SequenceNote = {
  after: number;
  placement: "left" | "right" | "over";
  of: string[];
  text: string;
};

/** 活性化の区間（メッセージの番号。end を含む） */
export type SequenceActivation = {
  id: string;
  start: number;
  end: number;
  depth: number;
};

/** 参加者のまとまり（box 〜 end） */
export type SequenceBox = {
  label: string;
  color: string | undefined;
  members: string[];
};

/** parseSequence の戻り値 */
export type Sequence = {
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  fragments: SequenceFragment[];
  notes: SequenceNote[];
  activations: SequenceActivation[];
  boxes: SequenceBox[];
  autonumber: boolean;
  problems: MapProblem[];
};

const SEQ_ID = "[\\w\\u0080-\\uffff]+";
const ARROW_RE = Object.keys(SEQ_ARROW_STYLES)
  .map((arrow) => arrow.replace(/[()]/g, "\\$&"))
  .join("|");
const MESSAGE_RE = new RegExp(
  `^(${SEQ_ID})\\s*(${ARROW_RE})\\s*([+-]?)(${SEQ_ID})\\s*:\\s*(.*)$`,
);
const FRAGMENT_RE = /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/;
const SECTION_RE = /^(else|and|option)\b\s*(.*)$/;
const NOTE_RE = new RegExp(
  `^note\\s+(left of|right of|over)\\s+(${SEQ_ID}(?:\\s*,\\s*${SEQ_ID})?)\\s*:\\s*(.*)$`,
  "i",
);
const DECL_RE = new RegExp(
  `^(?:create\\s+)?(participant|actor)\\s+(${SEQ_ID})(?:\\s+as\\s+(.+))?$`,
);
const TOGGLE_RE = new RegExp(`^(activate|deactivate)\\s+(${SEQ_ID})$`);
const IGNORED_RE = new RegExp(
  `^(destroy\\s+${SEQ_ID}|links?\\s+${SEQ_ID}\\s*:.*|title\\b.*|accTitle\\b.*|accDescr\\b.*)$`,
);

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の sequenceDiagram の記法で記載してください。`,
});

/** 読んでいる行（行の番号・元の行・直前の `%% block:` の名前） */
type LineAt = { line: number; raw: string; blockName?: string | undefined };

/** 行を読み、読んだら `true` を返却する */
type LineReader = (text: string, where: LineAt) => boolean;

/** ノートの置き場所 */
const notePlacementOf = (where: string): SequenceNote["placement"] => {
  const lower = where.toLowerCase();
  if (lower.startsWith("left")) return "left";
  return lower.startsWith("right") ? "right" : "over";
};

/** メッセージの活性化の印 */
const activationOf = (mark: string | undefined): "+" | "-" | undefined =>
  mark === "+" || mark === "-" ? mark : undefined;

/** `sequenceDiagram` の Mermaid を、参加者・メッセージ・ブロック・注記・活性化と読めない行の項目に読む */
export const parseSequence = (source: string): Sequence => {
  const participants = new Map<string, SequenceParticipant>();
  const messages: SequenceMessage[] = [];
  const fragments: SequenceFragment[] = [];
  const notes: SequenceNote[] = [];
  const activations: SequenceActivation[] = [];
  const boxes: SequenceBox[] = [];
  const problems: MapProblem[] = [];
  const open: SequenceFragment[] = [];
  const active = new Map<string, number[]>();
  let box: SequenceBox | undefined;
  let autonumber = false;
  /** 直前の `%% block: 名前` のコメント。次の行が rect なら、その名前にする */
  let pendingBlock: string | undefined;
  const ensure = (id: string): void => {
    if (!participants.has(id))
      participants.set(id, { id, label: id, actor: false });
  };
  const activate = (id: string, at: number): void => {
    const list = active.get(id) ?? [];
    list.push(at);
    active.set(id, list);
  };
  const deactivate = (id: string, at: number, where: LineAt): void => {
    const start = active.get(id)?.pop();
    if (start === undefined) {
      problems.push(unreadable(where.line, where.raw));
      return;
    }
    activations.push({
      id,
      start,
      end: at,
      depth: active.get(id)?.length ?? 0,
    });
  };
  /** 読めない行の項目を足す */
  const fail = (where: LineAt): void => {
    problems.push(unreadable(where.line, where.raw));
  };
  /** `box` の行なら、参加者のまとまりを開く */
  const readBox: LineReader = (text) => {
    const boxLine = /^box\b\s*(.*)$/.exec(text);
    if (!boxLine) return false;
    const rest = boxLine[1] ?? "";
    const color = /^(rgba?\([^)]*\)|transparent|[a-z]+)(?=\s|$)/i.exec(
      rest,
    )?.[0];
    box = {
      label: (color ? rest.slice(color.length) : rest).trim(),
      color,
      members: [],
    };
    boxes.push(box);
    return true;
  };
  /** `participant`・`actor` の行なら、参加者を足す */
  const readDecl: LineReader = (text) => {
    const decl = DECL_RE.exec(text);
    if (!decl?.[1] || !decl[2]) return false;
    participants.set(decl[2], {
      id: decl[2],
      label: decodeEntities(decl[3] ?? decl[2]),
      actor: decl[1] === "actor",
    });
    box?.members.push(decl[2]);
    return true;
  };
  /** ブロックを開く行なら、ブロックを足す（rect の名前は直前の `%% block:` のコメント） */
  const readFragment: LineReader = (text, where) => {
    const fragment = FRAGMENT_RE.exec(text);
    if (!fragment?.[1]) return false;
    const label =
      fragment[1] === "rect"
        ? (where.blockName ?? "")
        : decodeEntities(fragment[2] ?? "");
    const item: SequenceFragment = {
      kind: fragment[1] as SequenceFragment["kind"],
      label,
      depth: open.length,
      sections: [{ start: messages.length, label }],
      start: messages.length,
      end: messages.length,
    };
    open.push(item);
    fragments.push(item);
    return true;
  };
  /** 区間の行なら、開いたブロックに区間を足す */
  const readSection: LineReader = (text, where) => {
    const section = SECTION_RE.exec(text);
    if (!section) return false;
    const current = open.at(-1);
    if (current)
      current.sections.push({
        start: messages.length,
        label: decodeEntities(section[2] ?? ""),
      });
    else fail(where);
    return true;
  };
  /** `end` の行なら、参加者のまとまりかブロックを閉じる */
  const readEnd: LineReader = (text, where) => {
    if (text !== "end") return false;
    if (box && open.length === 0) {
      box = undefined;
      return true;
    }
    const current = open.pop();
    if (current) current.end = messages.length;
    else fail(where);
    return true;
  };
  /** `activate`・`deactivate` の行なら、活性化を始める・終える */
  const readToggle: LineReader = (text, where) => {
    const toggle = TOGGLE_RE.exec(text);
    if (!toggle?.[2]) return false;
    ensure(toggle[2]);
    if (toggle[1] === "activate") activate(toggle[2], messages.length);
    else deactivate(toggle[2], messages.length - 1, where);
    return true;
  };
  /** ノートの行なら、ノートを足す */
  const readNote: LineReader = (text) => {
    const note = NOTE_RE.exec(text);
    if (!note?.[1] || !note[2]) return false;
    const of = note[2].split(",").map((id) => id.trim());
    for (const id of of) ensure(id);
    notes.push({
      after: messages.length,
      placement: notePlacementOf(note[1]),
      of,
      text: decodeEntities(note[3] ?? ""),
    });
    return true;
  };
  /** メッセージの行なら、メッセージを足し、`+`・`-` の活性化を始める・終える */
  const readMessage: LineReader = (text, where) => {
    const message = MESSAGE_RE.exec(text);
    if (!message?.[1] || !message[2] || !message[4]) return false;
    ensure(message[1]);
    ensure(message[4]);
    const activation = activationOf(message[3]);
    messages.push({
      from: message[1],
      to: message[4],
      text: decodeEntities(message[5] ?? ""),
      arrow: message[2] as SequenceArrowName,
      activation,
    });
    const at = messages.length - 1;
    if (activation === "+") activate(message[4], at);
    if (activation === "-") deactivate(message[1], at, where);
    return true;
  };
  /** 行の読み方（先に当たった読み方で読む） */
  const readers: LineReader[] = [
    readBox,
    readDecl,
    (text) => IGNORED_RE.test(text),
    readFragment,
    readSection,
    readEnd,
    readToggle,
    readNote,
    readMessage,
  ];
  source
    .split("\n")
    .slice(1)
    .forEach((raw, index) => {
      const line = index + 1;
      const block = /^\s*%%\s*block:\s*(.*)$/.exec(raw);
      if (block) {
        pendingBlock = (block[1] ?? "").trim();
        return;
      }
      const text = raw.replace(/%%.*$/, "").trim();
      if (text === "") return;
      const blockName = pendingBlock;
      pendingBlock = undefined;
      if (text === "autonumber") {
        autonumber = true;
        return;
      }
      const where = { line, raw, blockName };
      if (!readers.some((read) => read(text, where))) fail(where);
    });
  for (const item of open) {
    item.end = messages.length;
    problems.push({
      kind: "map_invalid",
      message: `\`${item.kind}\` に閉じの \`end\` がありません。最後のメッセージで閉じたものとして描いています。`,
    });
  }
  return {
    participants: [...participants.values()],
    messages,
    fragments,
    notes,
    activations,
    boxes,
    autonumber,
    problems,
  };
};
