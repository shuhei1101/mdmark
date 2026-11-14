/** 階層の表の 1 行の計画 */
export type TreeRowPlan = {
  /** 全体のパス（`aliases[].id` の構造） */
  path: string;
  /** 親の全体のパス。最上位は空 */
  parent: string;
  /** 深さ（0 から） */
  depth: number;
  /** 末尾の名前（`aliases[]` の構造を含む） */
  name: string;
  /** 表に無い親を補った行か */
  virtual: boolean;
  /** 子を持つか */
  hasChildren: boolean;
  /** 元の行の位置（補った行は `undefined`） */
  source: number | undefined;
};

/** `aliases[].metadata.type` の構造のパスを `.` で分け、名前の並びと根からの親の全体のパスの並びを返却する */
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

/** 空でないキーのパスごとの、最初に記載した行の位置 */
function firstPositions(keys: string[]): Map<string, number> {
  const positions = new Map<string, number>();
  for (const [index, key] of keys.entries()) {
    const path = key.trim();
    if (path !== "" && !positions.has(path)) {
      positions.set(path, index);
    }
  }
  return positions;
}

/** 表の行のキーの並びから、表に無い親を子の最初の行の前に補った行の並びを返却する */
export function planTreeRows(keys: string[]): TreeRowPlan[] {
  const positions = firstPositions(keys);
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
        // 後ろに記載した親の行は、その子の前の場所で親にする
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

/** YAML のキーの行の頭（キーと `:`）に合う構造 */
const YAML_KEY =
  /^("(?:[^"\\]|\\.)*"|'[^']*'|[^\s#'"-][^:#]*?|-[^\s:#][^:#]*?):(?:\s|$)/;

/** 複数行の文字列を始める値（`|`・`>` と、そのマーカー） */
const BLOCK_SCALAR = /^[|>][+-]?\d*\s*(?:#.*)?$/;

/** 行の先頭の空白の数 */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** キーの文字の引用符を削除する */
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

/** キーのパスを求める間の、親のキーのインデントとパスの並び */
type PathStack = Array<{ indent: number; path: string }>;

/** インデントより浅い親のキーのパス（無ければ `""`）。深い・同じインデントの行は並びから取り除く */
function parentPath(stack: PathStack, indent: number): string {
  while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) {
    stack.pop();
  }
  return stack.at(-1)?.path ?? "";
}

/** 行の中身が `- ` の配列の要素なら、親のキーのパス（`[]` 付き）の下に配置し、`- ` の後ろの列と中身を返却する */
function enterItem(
  stack: PathStack,
  at: { column: number; rest: string },
): { column: number; rest: string } {
  const { column, rest } = at;
  if (rest !== "-" && !rest.startsWith("- ")) {
    return at;
  }
  const parent = parentPath(stack, column);
  stack.push({
    indent: column,
    path: parent.endsWith("[]") ? parent : `${parent}[]`,
  });
  const after = rest.slice(1);
  return {
    column: column + 1 + (after.length - after.trimStart().length),
    rest: after.trimStart(),
  };
}

/** 値の無いキーの次の中身の行が、キーを持つ `- ` の要素か（このキーの値はキーを持つ要素の配列） */
function opensKeyedItems(next: string | undefined, column: number): boolean {
  const nextRest = next?.trimStart() ?? "";
  return (
    next !== undefined &&
    indentOf(next) >= column &&
    nextRest.startsWith("- ") &&
    YAML_KEY.test(nextRest.slice(2).trimStart())
  );
}

/** キーの行のパスと、値が複数行の文字列を始めるか。キーを持たない行は `undefined` */
function keyLine(options: {
  stack: PathStack;
  at: { column: number; rest: string };
  /** 後ろの最初の中身の行 */
  next: () => string | undefined;
}): { path: string; block: boolean } | undefined {
  const { stack, at, next } = options;
  const key = YAML_KEY.exec(at.rest);
  if (key?.[1] === undefined) {
    return undefined;
  }
  const parent = parentPath(stack, at.column);
  const name = unquote(key[1]);
  const value = at.rest.slice(key[0].length).trim();
  const path = parent === "" ? name : `${parent}.${name}`;
  if (value === "" || value.startsWith("#")) {
    const items = opensKeyedItems(next(), at.column);
    return { path: items ? `${path}[]` : path, block: false };
  }
  return { path, block: BLOCK_SCALAR.test(value) };
}

/** YAML の行ごとに、インデントと `- ` から求めたキーのパスを返却する（キーを持たない行は `undefined`） */
export function yamlLinePaths(lines: string[]): Array<string | undefined> {
  const stack: PathStack = [];
  const paths: Array<string | undefined> = [];
  let blockIndent: number | undefined;
  for (const [index, line] of lines.entries()) {
    const indent = indentOf(line);
    const inBlock =
      blockIndent !== undefined && (!isContent(line) || indent > blockIndent);
    if (inBlock || !isContent(line)) {
      paths.push(undefined);
      continue;
    }
    blockIndent = undefined;
    const at = enterItem(stack, { column: indent, rest: line.slice(indent) });
    const found = keyLine({
      stack,
      at,
      next: () => lines.slice(index + 1).find(isContent),
    });
    if (found) {
      blockIndent = found.block ? at.column : undefined;
      stack.push({ indent: at.column, path: found.path });
    }
    paths.push(found?.path);
  }
  return paths;
}

/** 末尾の名前に単語を含む行とその祖先の行のパスの集まりと、該当した行のうち補った行でないものの数を返却する */
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
