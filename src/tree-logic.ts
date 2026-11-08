/** 階層の表の 1 行の計画 */
export type TreeRowPlan = {
  /** 全体のパス（`aliases[].id` の形） */
  path: string;
  /** 親の全体のパス。最上位は空 */
  parent: string;
  /** 深さ（0 から） */
  depth: number;
  /** 末尾の名前（`aliases[]` の形を含む） */
  name: string;
  /** 表に無い親を補った行か */
  virtual: boolean;
  /** 子を持つか */
  hasChildren: boolean;
  /** 元の行の位置（補った行は `undefined`） */
  source: number | undefined;
};

/** `aliases[].metadata.type` の形のパスを `.` で分け、名前の並びと根からの親の全体のパスの並びを返す */
export function splitKeyPath(path: string): {
  names: string[];
  parents: string[];
} {
  const names = path.split(".").filter((name) => name !== "");
  const parents = names
    .slice(0, -1)
    .map((_, index) => names.slice(0, index + 1).join("."));
  return { names, parents };
}

/** 表の行のキーの並びから、表に無い親を子の最初の行の前に補った行の並びを返す */
export function planTreeRows(keys: string[]): TreeRowPlan[] {
  const positions = new Map<string, number>();
  for (const [index, key] of keys.entries()) {
    const path = key.trim();
    if (path !== "" && !positions.has(path)) {
      positions.set(path, index);
    }
  }
  const rows: TreeRowPlan[] = [];
  const placed = new Set<string>();
  const place = (path: string, source: number | undefined): void => {
    const { names, parents } = splitKeyPath(path);
    rows.push({
      path,
      parent: parents.at(-1) ?? "",
      depth: Math.max(names.length - 1, 0),
      name: names.at(-1) ?? "",
      virtual: source === undefined,
      hasChildren: false,
      source,
    });
    placed.add(path);
  };
  for (const [index, key] of keys.entries()) {
    const path = key.trim();
    if (path === "") {
      // 空のキーの行は深さ 0 の行としてそのまま残す
      place("", index);
      continue;
    }
    if (placed.has(path)) {
      continue;
    }
    for (const parent of splitKeyPath(path).parents) {
      if (!placed.has(parent)) {
        // 後ろに書いた親の行は、その子の前の場所で親にする
        place(parent, positions.get(parent));
      }
    }
    place(path, index);
  }
  const parents = new Set(rows.map((row) => row.parent));
  for (const row of rows) {
    row.hasChildren = row.path !== "" && parents.has(row.path);
  }
  return rows;
}

/** YAML のキーの行の頭（キーと `:`）に合う形 */
const YAML_KEY =
  /^("(?:[^"\\]|\\.)*"|'[^']*'|[^\s#'"-][^:#]*?|-[^\s:#][^:#]*?):(?:\s|$)/;

/** 複数行の文字列を始める値（`|`・`>` と、その印） */
const BLOCK_SCALAR = /^[|>][+-]?\d*\s*(?:#.*)?$/;

/** 行の先頭の空白の数 */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** キーの文字の引用符を外す */
function unquote(key: string): string {
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    return key.slice(1, -1);
  }
  return key.trim();
}

/** コメントでも空でもない行か */
function isContent(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== "" && !trimmed.startsWith("#");
}

/** YAML の行ごとに、インデントと `- ` から求めたキーのパスを返す（キーを持たない行は `undefined`） */
export function yamlLinePaths(lines: string[]): Array<string | undefined> {
  const stack: Array<{ indent: number; path: string }> = [];
  const paths: Array<string | undefined> = [];
  let blockIndent: number | undefined;
  const parentPath = (indent: number): string => {
    while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) {
      stack.pop();
    }
    return stack.at(-1)?.path ?? "";
  };
  for (const [index, line] of lines.entries()) {
    const indent = indentOf(line);
    if (blockIndent !== undefined) {
      if (!isContent(line) || indent > blockIndent) {
        paths.push(undefined);
        continue;
      }
      blockIndent = undefined;
    }
    if (!isContent(line)) {
      paths.push(undefined);
      continue;
    }
    let column = indent;
    let rest = line.slice(indent);
    let path: string | undefined;
    if (rest === "-" || rest.startsWith("- ")) {
      // 配列の要素は、親のキーのパス（`[]` 付き）の下に置く
      const parent = parentPath(column);
      const item = parent.endsWith("[]") ? parent : `${parent}[]`;
      stack.push({ indent: column, path: item });
      const after = rest.slice(1);
      column += 1 + (after.length - after.trimStart().length);
      rest = after.trimStart();
    }
    const key = YAML_KEY.exec(rest);
    if (key?.[1] !== undefined) {
      const parent = parentPath(column);
      const name = unquote(key[1]);
      const value = rest.slice(key[0].length).trim();
      path = parent === "" ? name : `${parent}.${name}`;
      if (value === "" || value.startsWith("#")) {
        // 次の中身の行がキーを持つ `- ` の要素のとき、このキーの値はキーを持つ要素の配列
        const next = lines.slice(index + 1).find(isContent);
        const nextRest = next?.trimStart() ?? "";
        if (
          next !== undefined &&
          indentOf(next) >= column &&
          nextRest.startsWith("- ") &&
          YAML_KEY.test(nextRest.slice(2).trimStart())
        ) {
          path = `${path}[]`;
        }
      } else if (BLOCK_SCALAR.test(value)) {
        blockIndent = column;
      }
      stack.push({ indent: column, path });
    }
    paths.push(path);
  }
  return paths;
}

/** 末尾の名前に単語を含む行とその祖先の行のパスの集まりと、当たった行のうち補った行でないものの数を返す */
export function filterTreeRows(options: {
  /** `planTreeRows` の行 */
  rows: TreeRowPlan[];
  /** 絞り込みの単語 */
  word: string;
}): { keep: Set<string>; hits: Set<string>; count: number } {
  const { rows } = options;
  const word = options.word.trim().toLowerCase();
  if (word === "") {
    return {
      keep: new Set(rows.map((row) => row.path)),
      hits: new Set(),
      count: rows.filter((row) => !row.virtual).length,
    };
  }
  const hitRows = rows.filter((row) => row.name.toLowerCase().includes(word));
  const keep = new Set<string>();
  for (const row of hitRows) {
    keep.add(row.path);
    for (const parent of splitKeyPath(row.path).parents) {
      keep.add(parent);
    }
  }
  return {
    keep,
    hits: new Set(hitRows.map((row) => row.path)),
    count: hitRows.filter((row) => !row.virtual).length,
  };
}
