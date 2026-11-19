import { vi } from "vitest";

/** 部品の木のノード（テストで組み立てた `h` の結果） */
export type FakeNode = {
  type: string;
  props: Record<string, unknown>;
  children: unknown[];
};

/** `h` の代わりに、部品の名前と属性と子を持つオブジェクトを作る */
export const fakeH = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): FakeNode => ({
  type: typeof type === "string" ? type : String(type),
  props: props ?? {},
  children: children
    .flat(Number.POSITIVE_INFINITY)
    .filter(
      (child) => child !== undefined && child !== null && child !== false,
    ),
});

/** テストの間だけ、mod の環境の `h` を置き換える */
export const installH = (): void => {
  (globalThis as { h?: unknown }).h = fakeH;
};

/** `$.ui.resolve` が返却する部品（名前の文字列で代用する） */
export const FAKE_ELEMENTS = {
  Box: "Box",
  Text: "Text",
  Button: "Button",
  Markdown: "Markdown",
  Code: "Code",
};

/** 部品の木をたどり、条件に合うノードを全て返却する */
export const findNodes = (
  node: unknown,
  match: (node: FakeNode) => boolean,
): FakeNode[] => {
  if (typeof node !== "object" || node === null || !("type" in node)) {
    return [];
  }
  const current = node as FakeNode;
  const below = current.children.flatMap((child) => findNodes(child, match));
  return match(current) ? [current, ...below] : below;
};

/** 部品の木の文字列（Text の子・Button の label・Code の source・Markdown の text）を、記載した順につないで返却する */
export const textOf = (node: unknown): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (typeof node !== "object" || node === null || !("type" in node)) {
    return "";
  }
  const current = node as FakeNode;
  const own = ["label", "source", "text"]
    .map((key) => current.props[key])
    .filter((value): value is string => typeof value === "string")
    .join("");
  return own + current.children.map(textOf).join("");
};

/** テストの engine の材料 */
export type FakeEngineOptions = {
  /** 環境変数 */
  env?: Record<string, string>;
  /** パスから本文のファイル */
  files?: Record<string, string>;
  /** 起動したプロジェクトの直下 */
  root?: string;
  /** Claude Code のテーマ */
  theme?: string;
};

/** mod の `$` の代わり。呼び出しを確かめるため、関数を `vi.fn` にする */
export const createFakeEngine = (options: FakeEngineOptions = {}) => {
  const env = options.env ?? { HOME: "/home/u" };
  const files = options.files ?? {};
  return {
    env: { get: vi.fn(async (name: string) => env[name]) },
    fs: {
      exists: vi.fn(async (path: string) =>
        Object.keys(files).some(
          (file) => file === path || file.startsWith(`${path}/`),
        ),
      ),
      read: vi.fn(async (path: string) => {
        const body = files[path];
        if (body === undefined) {
          throw new Error(`ENOENT: ${path}`);
        }
        return body;
      }),
      list: vi.fn(async (path: string) => {
        const prefix = `${path.replace(/\/$/, "")}/`;
        const names = new Map<string, "file" | "dir">();
        for (const file of Object.keys(files)) {
          if (!file.startsWith(prefix)) {
            continue;
          }
          const [first, ...more] = file.slice(prefix.length).split("/");
          if (first !== undefined) {
            names.set(first, more.length > 0 ? "dir" : "file");
          }
        }
        return [...names].map(([name, kind]) => ({
          name,
          kind,
          size: 0,
          mtimeMs: 0,
        }));
      }),
    },
    session: { root: vi.fn(async () => options.root ?? "/work/project") },
    settings: {
      read: vi.fn(async (args?: { key?: string }) =>
        args?.key === "theme" ? (options.theme ?? "dark") : {},
      ),
    },
    ui: {
      resolve: vi.fn(() => FAKE_ELEMENTS),
      log: vi.fn(),
      copy: vi.fn(async () => ({})),
      invalidate: vi.fn(),
    },
  };
};

/** テストの engine の型 */
export type FakeEngine = ReturnType<typeof createFakeEngine>;

/** Button の `onPress` を呼ぶ。Button か `onPress` が無ければ失敗する */
export const pressButton = async (
  node: FakeNode | undefined,
): Promise<void> => {
  const onPress = node?.props.onPress;
  if (typeof onPress !== "function") {
    throw new Error("onPress を持つ Button がありません");
  }
  await onPress();
};
