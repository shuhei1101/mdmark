import { vi } from "vitest";

/** 縦に追加したブロックの高さ（px） */
export const BLOCK_HEIGHT = 100;
/** `createMdmark` の代役が縦に並べるブロックの数 */
const BLOCK_COUNT = 40;
/** `createMdmarkModuleUrl` の代役が縦に並べるブロックの数（元の行番号 30 を先頭に配置できるだけの高さにする） */
const MODULE_BLOCK_COUNT = 80;

/** `mount` の代役が描いた先の要素と戻り値の記録 */
export type MountRecord = {
  mount: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  elements: HTMLElement[];
};

/** 元の行番号を持つブロックを縦に追加した `mount` と、戻り値の `update`・`destroy` を記録する mdmark の代役を作る */
export const createMdmark = (
  options: { diffModes?: unknown } = {},
): { mdmark: { mount: never; diffModes?: unknown }; record: MountRecord } => {
  const elements: HTMLElement[] = [];
  const update = vi.fn();
  const destroy = vi.fn((): void => {
    for (const element of elements) {
      element.replaceChildren();
    }
  });
  const mount = vi.fn((element: HTMLElement) => {
    elements.push(element);
    for (let line = 0; line < BLOCK_COUNT; line += 1) {
      const block = document.createElement("div");
      block.dataset.sourceLine = String(line);
      block.style.height = `${BLOCK_HEIGHT}px`;
      element.append(block);
    }
    return { update, destroy };
  });
  return {
    mdmark: {
      mount: mount as never,
      diffModes: "diffModes" in options ? options.diffModes : ["blocks"],
    },
    record: { mount, update, destroy, elements },
  };
};

/** 元の行番号を持つブロックを縦に追加して描く `mount` を持つ配布物の代役のモジュールの URL を作る */
export const createMdmarkModuleUrl = (): string =>
  URL.createObjectURL(
    new Blob(
      [
        `export const diffModes = ["blocks"];
export const mount = (element) => {
  for (let line = 0; line < ${MODULE_BLOCK_COUNT}; line += 1) {
    const block = document.createElement("div");
    block.dataset.sourceLine = String(line);
    block.style.height = "${BLOCK_HEIGHT}px";
    element.append(block);
  }
  return { update() {}, destroy() { element.replaceChildren(); } };
};`,
      ],
      { type: "text/javascript" },
    ),
  );

/** `render` のメッセージを作る */
export const renderMessage = (
  markdown: string,
  options: {
    config?: Record<string, unknown>;
    theme?: "auto" | "light" | "dark";
    previous?: string;
  } = {},
) => ({
  type: "render" as const,
  markdown,
  ...(options.previous === undefined ? {} : { previous: options.previous }),
  config: options.config ?? {},
  theme: options.theme ?? "auto",
});

/** 画面がスクロールする要素 */
export const scroller = (): Element =>
  document.scrollingElement ?? document.documentElement;

/** 描画の次のフレームまで待つ（`scroll` の通知を 1 フレームにまとめる処理を経由する） */
export const nextFrames = async (count = 2): Promise<void> => {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

/** 元の行番号 `line` のブロックの先頭が画面の先頭に来る `scrollTop` */
export const topOfLine = (line: number): number => {
  const block = document.querySelector(`[data-source-line="${line}"]`);
  return (block?.getBoundingClientRect().top ?? 0) + scroller().scrollTop;
};

/** 拡張機能からのメッセージを `window` に送信する */
export const sendHostMessage = (data: unknown): void => {
  window.dispatchEvent(new MessageEvent("message", { data }));
};

/** 描く先を包む要素（`#mdmark-preview`）を作ってページに配置する。後で削除するため `placed` に記録する */
export const createRoot = (
  placed: HTMLElement[],
  dataset: Record<string, string> = {},
): HTMLElement => {
  const root = document.createElement("div");
  root.id = "mdmark-preview";
  root.dataset.configPath = "mdmark.config.yaml";
  Object.assign(root.dataset, dataset);
  document.body.append(root);
  placed.push(root);
  return root;
};
