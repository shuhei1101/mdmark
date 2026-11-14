import type { Sequence, SequenceFragment } from "./sequence.ts";

/** シーケンス図の表示する 1 行 */
export type SequenceRow =
  | { kind: "message"; message: number }
  | { kind: "collapsed"; fragment: number; count: number }
  | { kind: "fragment"; fragment: number }
  | { kind: "section"; fragment: number; section: number }
  | { kind: "note"; note: number }
  | { kind: "gap" };

/** シーケンス図の見せ方 */
export type SequenceView = {
  order: string[];
  collapsed: number[];
  entered: number | undefined;
};

/** 並び順・閉じたブロック・中だけを描くブロックから、表示する参加者と行を返す */
export const sequenceRows = (
  sequence: Sequence,
  view: SequenceView,
): { participants: string[]; rows: SequenceRow[]; headRows: number } => {
  const entered =
    view.entered === undefined ? undefined : sequence.fragments[view.entered];
  const inScope = (message: number) =>
    entered === undefined ||
    (message >= entered.start && message < entered.end);
  const used = new Set<string>();
  sequence.messages.forEach((message, index) => {
    if (inScope(index)) {
      used.add(message.from);
      used.add(message.to);
    }
  });
  const known = sequence.participants.map((item) => item.id);
  const order = [
    ...view.order.filter((id) => known.includes(id)),
    ...known.filter((id) => !view.order.includes(id)),
  ];
  const participants =
    entered === undefined ? order : order.filter((id) => used.has(id));
  const collapsed = new Set(view.collapsed);
  /** 中だけを描くブロックの外にはみ出すブロックか */
  const outsideEntered = (fragment: SequenceFragment): boolean =>
    entered !== undefined &&
    (fragment.start < entered.start || fragment.end > entered.end);
  /** メッセージを含む最も外側の閉じたブロック（中だけを描くブロックの外は数えない） */
  const closedOf = (message: number): number | undefined => {
    let found: number | undefined;
    sequence.fragments.forEach((fragment, index) => {
      if (!collapsed.has(index) || index === view.entered) return;
      if (message < fragment.start || message >= fragment.end) return;
      if (outsideEntered(fragment)) return;
      const current =
        found === undefined ? undefined : sequence.fragments[found];
      if (current === undefined || fragment.depth < current.depth)
        found = index;
    });
    return found;
  };
  const rows: SequenceRow[] = [];
  const emitted = new Set<number>();
  sequence.messages.forEach((_message, index) => {
    if (!inScope(index)) return;
    for (const [n, note] of sequence.notes.entries()) {
      if (note.after === index)
        rows.push({ kind: "gap" }, { kind: "note", note: n });
    }
    sequence.fragments.forEach((fragment, f) => {
      if (
        fragment.start !== index ||
        collapsed.has(f) ||
        closedOf(index) !== undefined
      )
        return;
      if (f !== view.entered && outsideEntered(fragment)) return;
      rows.push({ kind: "gap" }, { kind: "fragment", fragment: f });
      fragment.sections.forEach((section, s) => {
        if (s > 0 && section.start === index)
          rows.push(
            { kind: "gap" },
            { kind: "section", fragment: f, section: s },
          );
      });
    });
    sequence.fragments.forEach((fragment, f) => {
      if (collapsed.has(f) || closedOf(index) !== undefined) return;
      fragment.sections.forEach((section, s) => {
        if (s > 0 && section.start === index && fragment.start !== index)
          rows.push(
            { kind: "gap" },
            { kind: "section", fragment: f, section: s },
          );
      });
    });
    const closed = closedOf(index);
    if (closed !== undefined) {
      if (!emitted.has(closed)) {
        emitted.add(closed);
        const fragment = sequence.fragments[closed];
        const count =
          fragment === undefined
            ? 0
            : sequence.messages.filter(
                (_m, i) =>
                  i >= fragment.start && i < fragment.end && inScope(i),
              ).length;
        rows.push({ kind: "collapsed", fragment: closed, count });
      }
      return;
    }
    rows.push({ kind: "message", message: index });
  });
  for (const [n, note] of sequence.notes.entries()) {
    if (note.after >= sequence.messages.length && entered === undefined)
      rows.push({ kind: "gap" }, { kind: "note", note: n });
  }
  const tallest = Math.max(
    1,
    ...participants.map(
      (id) =>
        (
          sequence.participants.find((item) => item.id === id)?.label ?? id
        ).split("\n").length,
    ),
  );
  return { participants, rows, headRows: Math.max(0, tallest - 1) };
};
