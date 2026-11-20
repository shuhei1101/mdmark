import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 描いた結果の操作を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadPreviews = (): Promise<
  typeof import("../../../../src/code-block/code-preview.interact.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/code-block/code-preview.interact.ts",
      import.meta.url,
    ).href
  );

/** コピーのボタンの操作を読み込む（Raw のボタンを配置する帯の右の塊を作る） */
const loadCopy = () =>
  import("../../../../src/code-block/code-block.interact.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** `render` が出すコードブロックと同じ構造の HTML */
const codeBlock = (
  source: string,
  options: { markdown?: boolean; raw?: boolean; language?: string } = {},
): string => {
  const { markdown = true, raw = false, language = "markdown" } = options;
  const marks = `${markdown ? " data-mdmark-markdown" : ""}${raw ? " data-mdmark-raw" : ""}`;
  return `<div class="mdmark-code"${marks}><div class="mdmark-code-bar"><span class="mdmark-code-lang"><span class="mdmark-code-lang-name" aria-hidden="true">${language}</span></span></div><pre tabindex="0" aria-label="コード: ${language}"><code class="language-${language}">${source}\n</code></pre></div>`;
};

/** コードブロックを配置し、コピーのボタンを付けてから描いた結果を付ける */
async function setUp(
  html: string,
  renderPreview: (el: HTMLElement, markdown: string) => () => void,
) {
  const { attachCodeCopy } = await loadCopy();
  const { attachCodePreviews } = await loadPreviews();
  const root = createRootFromHtml(html);
  detachers.push(attachCodeCopy(root));
  const detach = attachCodePreviews(root, renderPreview);
  detachers.push(detach);
  return { root, detach };
}

/** 描いた結果の要素に HTML を入れる `renderPreview` */
const renderInto =
  (html: string, calls: string[]) =>
  (el: HTMLElement, markdown: string): (() => void) => {
    calls.push(markdown);
    el.innerHTML = html;
    return () => {};
  };

/** n 番目のコードブロックの要素 */
const blockAt = (root: HTMLElement, index: number): HTMLElement =>
  root.querySelectorAll<HTMLElement>(":scope > .mdmark-code")[
    index
  ] as HTMLElement;

// 既定で描いた結果を出し、押すと元の Markdown に切り替える（正常系）
test("test_attach_code_previews", async () => {
  // 準備
  const calls: string[] = [];
  const { root } = await setUp(
    codeBlock("# 見出し") +
      codeBlock('import { mount } from "mdmark";', {
        markdown: false,
        language: "ts",
      }),
    renderInto('<h1 id="a">見出し</h1>', calls),
  );
  const block = blockAt(root, 0);
  const pre = block.querySelector("pre") as HTMLElement;
  const preview = block.querySelector(".mdmark-code-preview") as HTMLElement;
  const button = block.querySelector(
    "button.mdmark-code-raw",
  ) as HTMLButtonElement;
  // 検証: 付けた直後
  expect(calls).toEqual(["# 見出し"]);
  expect(pre.hidden).toBe(true);
  expect(preview.hidden).toBe(false);
  expect(preview.querySelector("h1")?.id).toMatch(/^mdmark-preview-\d+-a$/);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  // 実行・検証: 1 回目
  button.click();
  expect(preview.hidden).toBe(true);
  expect(pre.hidden).toBe(false);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  // 実行・検証: 2 回目
  button.click();
  expect(preview.hidden).toBe(false);
  expect(pre.hidden).toBe(true);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(calls).toHaveLength(1);
  // 検証: ts のコードブロックにはボタンも描いた結果も無い
  const ts = blockAt(root, 1);
  expect(ts.querySelector(".mdmark-code-raw")).toBeNull();
  expect(ts.querySelector(".mdmark-code-preview")).toBeNull();
});

// data-mdmark-raw のコードブロックは初めて描いた結果へ切り替えたときに描く（正常系）
test("test_attach_code_previews_when_raw", async () => {
  // 準備
  const calls: string[] = [];
  const { root } = await setUp(
    codeBlock("# 見出し", { raw: true }),
    renderInto("<h1>見出し</h1>", calls),
  );
  const block = blockAt(root, 0);
  const pre = block.querySelector("pre") as HTMLElement;
  const button = block.querySelector(
    "button.mdmark-code-raw",
  ) as HTMLButtonElement;
  // 検証: 付けた直後
  expect(calls).toHaveLength(0);
  expect(pre.hidden).toBe(false);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  // 実行
  button.click();
  // 検証
  const preview = block.querySelector(".mdmark-code-preview") as HTMLElement;
  expect(calls).toHaveLength(1);
  expect(preview.hidden).toBe(false);
  expect(preview.querySelector("h1")).not.toBeNull();
  expect(pre.hidden).toBe(true);
});

// 描けなければ元の Markdown のままにする（異常系）
test("test_attach_code_previews_when_render_failed", async () => {
  // 準備・実行
  const { root } = await setUp(codeBlock("# 見出し"), () => {
    throw new Error("描けない");
  });
  // 検証
  const block = blockAt(root, 0);
  expect((block.querySelector("pre") as HTMLElement).hidden).toBe(false);
  expect(block.querySelector(".mdmark-code-raw")).toBeNull();
  expect(block.querySelector(".mdmark-code-preview")).toBeNull();
});

// 削除すると描いた結果とボタンを取り除く（正常系）
test("test_attach_code_previews_when_detached", async () => {
  // 準備
  const cleanup = vi.fn();
  const { root, detach } = await setUp(codeBlock("# 見出し"), (el) => {
    el.innerHTML = "<h1>見出し</h1>";
    return cleanup;
  });
  // 実行
  detach();
  // 検証
  const block = blockAt(root, 0);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(block.querySelector(".mdmark-code-raw")).toBeNull();
  expect(block.querySelector(".mdmark-code-preview")).toBeNull();
  expect((block.querySelector("pre") as HTMLElement).hidden).toBe(false);
});

// 入れ子の raw を遅れて描いても id が重ならない（正常系）
test("test_attach_code_previews_when_nested_raw", async () => {
  // 準備
  const { attachCodeCopy } = await loadCopy();
  const { attachCodePreviews } = await loadPreviews();
  const renderNested = (el: HTMLElement, markdown: string): (() => void) => {
    el.innerHTML = `<h2 id="x">${markdown}</h2>${codeBlock("## x", { raw: true })}`;
    const detachCopy = attachCodeCopy(el);
    const detachPreviews = attachCodePreviews(el, (inner) => {
      inner.innerHTML = '<h2 id="x">x</h2>';
      return () => {};
    });
    return () => {
      detachPreviews();
      detachCopy();
    };
  };
  const { root } = await setUp(
    codeBlock("# a") + codeBlock("# b"),
    renderNested,
  );
  // 実行: 入れ子の Raw のボタンを 2 つとも押す
  for (const block of root.querySelectorAll<HTMLElement>(
    ".mdmark-code-preview .mdmark-code",
  )) {
    block.querySelector<HTMLButtonElement>("button.mdmark-code-raw")?.click();
  }
  // 検証
  const ids = [...root.querySelectorAll("[id]")].map((element) => element.id);
  expect(ids.length).toBeGreaterThanOrEqual(4);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(id.startsWith("mdmark-preview-")).toBe(true);
  }
});

// id とそれを指す属性に頭を付ける（正常系）
test("test_prefix_preview_ids", async () => {
  // 準備
  const { prefixPreviewIds } = await loadPreviews();
  const el = createRootFromHtml(
    '<h2 id="x">x</h2><a class="inner" href="#x">x</a><button aria-controls="x y">b</button><a class="outer" href="#outer">o</a>',
  );
  // 実行
  prefixPreviewIds(el, 2);
  // 検証
  expect(el.querySelector("h2")?.id).toBe("mdmark-preview-2-x");
  expect(el.querySelector("a.inner")?.getAttribute("href")).toBe(
    "#mdmark-preview-2-x",
  );
  expect(el.querySelector("button")?.getAttribute("aria-controls")).toBe(
    "mdmark-preview-2-x y",
  );
  expect(el.querySelector("a.outer")?.getAttribute("href")).toBe("#outer");
});
