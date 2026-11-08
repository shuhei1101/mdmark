/** 行の頭の空白から、コードブロックの中で最も小さいインデントの幅（空白の数）を 1 レベル、タブを 1 レベルとしてレベルを決める。空白だけの行と空行は `undefined` */
export function measureIndents(texts: string[]): Array<number | undefined> {
  const heads = texts.map((text) =>
    text.trim() === "" ? undefined : (/^[ \t]*/.exec(text)?.[0] ?? ""),
  );
  const spaceCounts = heads.flatMap((head) => {
    const spaces = head?.replaceAll("\t", "").length ?? 0;
    return spaces > 0 ? [spaces] : [];
  });
  const unit = spaceCounts.length > 0 ? Math.min(...spaceCounts) : 1;
  return heads.map((head) => {
    if (head === undefined) {
      return undefined;
    }
    const spaces = head.replaceAll("\t", "").length;
    const tabs = head.length - spaces;
    return tabs + Math.floor(spaces / unit);
  });
}

/** 次の空でない行がより深い行を畳める行とし、その後ろの、次の同じ深さ以下の行の手前までの行の数を返却する（範囲の末尾の空行は含めない）。畳めない行は `undefined` */
export function foldLinesOf(
  indents: Array<number | undefined>,
): Array<number | undefined> {
  return indents.map((indent, index) => {
    if (indent === undefined) {
      return undefined;
    }
    // 範囲の最後の空でない行
    let last = index;
    for (let next = index + 1; next < indents.length; next++) {
      const level = indents[next];
      if (level === undefined) {
        continue;
      }
      if (level <= indent) {
        break;
      }
      last = next;
    }
    return last > index ? last - index : undefined;
  });
}

/** 畳んだ行の後ろの畳む行の数の行を、隠す行の位置（0 から）にする。内側の畳んだ状態は外側を開いても残る */
export function hiddenLinesOf(options: {
  foldLines: Array<number | undefined>;
  folded: boolean[];
}): Set<number> {
  const { foldLines, folded } = options;
  const hidden = new Set<number>();
  foldLines.forEach((count, index) => {
    if (count === undefined || !folded[index]) {
      return;
    }
    for (let line = index + 1; line <= index + count; line++) {
      hidden.add(line);
    }
  });
  return hidden;
}

/** 行を含む最も内側の畳める範囲（畳める行の後ろの畳む行の数の行）を返却する。深さは範囲の畳める行のレベルに 1 を追加した値。含む範囲が無ければ `undefined` */
export function guideRangeOf(options: {
  indents: Array<number | undefined>;
  foldLines: Array<number | undefined>;
  index: number;
}): { from: number; to: number; depth: number } | undefined {
  const { indents, foldLines, index } = options;
  let found: { from: number; to: number; depth: number } | undefined;
  foldLines.forEach((count, start) => {
    if (count === undefined) {
      return;
    }
    const from = start + 1;
    const to = start + count;
    // 後ろで始まる範囲ほど内側にある
    if (from <= index && index <= to) {
      found = { from, to, depth: (indents[start] ?? 0) + 1 };
    }
  });
  return found;
}
