import { afterEach, expect, test, vi } from "vitest";
import type { MdmarkMarkArgs } from "../../../src/extensions.ts";
import type { MountHandle, MountOptions } from "../../../src/mount.ts";

/** 描く処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMount = () => import("../../../src/mount.ts");

// 閉じた折り畳みを 1 つ持つ文書
const DETAILS_MARKDOWN = "<details><summary>s</summary>b</details>\n";

// 絞り込みを持つ表の文書
const TABLE_MARKDOWN = [
  "<!-- table: data filter=名前 -->",
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| a | 1 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// タブを持つ文書
const TABS_MARKDOWN = [
  "<!-- tabs -->",
  "",
  "### A",
  "",
  "a",
  "",
  "### B",
  "",
  "b",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

const elements: HTMLElement[] = [];
const handles: MountHandle[] = [];

/** 描く先の要素を作り、ページに置く */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** 要素に文書を描き、後始末のために戻り値を控える */
async function mountTracked(
  el: HTMLElement,
  opts: MountOptions,
): Promise<MountHandle> {
  const { mount } = await loadMount();
  const handle = mount(el, opts);
  handles.push(handle);
  return handle;
}

/** 要素の中の折り畳みを返す */
function findDetails(el: HTMLElement): HTMLDetailsElement {
  const details = el.querySelector("details");
  if (!details) {
    throw new Error("details が描かれていない");
  }
  return details;
}

/** 印刷の前のイベントを送る */
function sendBeforePrint(): void {
  window.dispatchEvent(new Event("beforeprint"));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
});

// 要素に本文を描き、class を付ける（正常系）
test("test_mount", async () => {
  // 準備
  const el = createElement();
  // 実行
  const handle = await mountTracked(el, { markdown: "# 見出し" });
  // 検証
  expect(el.classList.contains("mdmark")).toBe(true);
  expect(el.querySelector("h1")?.textContent).toBe("見出し");
  expect(typeof handle.update).toBe("function");
  expect(typeof handle.destroy).toBe("function");
});

// update で本文だけを描き直す（正常系）
test("test_mount_when_updated", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# A" });
  // 実行
  handle.update("# B");
  // 検証
  expect(el.children).toHaveLength(1);
  expect(el.querySelector("h1")?.textContent).toBe("B");
  expect(el.classList.contains("mdmark")).toBe(true);
});

// destroy で片付け、その後の update と 2 回目の destroy は何もしない（正常系）
test("test_mount_when_destroyed", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# A" });
  // 実行
  handle.destroy();
  // 検証
  expect(() => {
    handle.update("# B");
    handle.destroy();
  }).not.toThrow();
  expect(el.innerHTML).toBe("");
  expect(el.classList.contains("mdmark")).toBe(false);
});

// 同じ要素へもう一度描くと、前の描画を片付けてから描く（正常系）
test("test_mount_when_remounted", async () => {
  // 準備
  const el = createElement();
  const first = await mountTracked(el, { markdown: "# A" });
  await mountTracked(el, { markdown: "# B" });
  // 実行
  first.update("# C");
  // 検証
  expect(el.children).toHaveLength(1);
  expect(el.querySelector("h1")?.textContent).toBe("B");
});

// 文書の印で印刷の機能を外すと、印刷の前に折り畳みを開かない（正常系）
test("test_mount_when_print_disabled_by_mark", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: `<!-- features: -print -->\n\n${DETAILS_MARKDOWN}`,
  });
  // 実行
  sendBeforePrint();
  // 検証
  expect(findDetails(el).open).toBe(false);
});

// update で描き直した文書の印が印刷の機能に効く（正常系）
test("test_mount_when_updated_with_print_mark", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "段落\n" });
  handle.update(`<!-- features: -print -->\n\n${DETAILS_MARKDOWN}`);
  // 実行
  sendBeforePrint();
  // 検証
  expect(findDetails(el).open).toBe(false);
});

// 描き直すと前の操作を外し、新しい本文に操作を付ける（正常系）
test("test_mount_when_updated_with_syntax", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: TABLE_MARKDOWN });
  el.querySelector<HTMLButtonElement>("button.mdmark-filter")?.click();
  const removeSpy = vi.spyOn(document, "removeEventListener");
  // 実行
  handle.update(TABS_MARKDOWN);
  // 検証
  const types = removeSpy.mock.calls.map(([type]) => type);
  expect(types).toContain("pointerdown");
  expect(types).toContain("keydown");
  expect(el.querySelector('[role="tablist"]')).not.toBeNull();
});

/** 範囲で書いた拡張の印を持つ文書 */
function definitionMarkdown(json: string): string {
  return [
    "前の段落",
    "",
    "<!-- greet -->",
    "",
    "```json",
    json,
    "```",
    "",
    "<!-- /greet -->",
    "",
    "後ろの段落",
    "",
  ].join("\n");
}

// 範囲の部品の定義を schema と draw に渡し、定義の JSON を文書に残さない（正常系）
test("test_mount_when_extension_definition", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await import(
    "../../../src/extensions.ts"
  );
  resetExtensions();
  const received: unknown[] = [];
  const load = vi.fn(async () => ({
    draw(slot: HTMLElement, value: MdmarkMarkArgs) {
      const { definition } = value as { definition?: unknown };
      received.push(definition);
      const { title, items } = definition as { title: string; items: string[] };
      slot.textContent = `${title} ${items.length}`;
    },
  }));
  registerExtension({ name: "greet", directive: "greet", load });
  const el = createElement();
  try {
    // 実行
    await mountTracked(el, {
      markdown: definitionMarkdown(
        '{"title": "段取り", "items": ["a", "b", "c"]}',
      ),
    });
    // 検証
    await vi.waitFor(() => {
      expect(el.textContent).toContain("段取り 3");
    });
    expect(received).toEqual([{ title: "段取り", items: ["a", "b", "c"] }]);
    expect(el.innerHTML).not.toContain('"items"');
    expect(load).toHaveBeenCalledTimes(1);
  } finally {
    resetExtensions();
  }
});

// 範囲の部品の定義を JSON として読めないときは、schema も load も呼ばず書き方の警告にする（異常系）
test("test_mount_when_extension_definition_invalid", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await import(
    "../../../src/extensions.ts"
  );
  resetExtensions();
  const load = vi.fn(async () => ({ draw: () => {} }));
  const validate = vi.fn(() => ({ value: { args: [], keys: {} } }));
  registerExtension({
    name: "greet",
    directive: "greet",
    load,
    schema: { "~standard": { version: 1, vendor: "test", validate } },
  });
  const el = createElement();
  try {
    // 実行
    await mountTracked(el, {
      markdown: definitionMarkdown('{"title": "段取り",'),
    });
    // 検証
    await vi.waitFor(() => {
      expect(el.querySelector(".mdmark-syntax-warning")).not.toBeNull();
    });
    const warning = el.querySelector(".mdmark-syntax-warning")?.textContent;
    expect(warning).toContain("greet");
    expect(load).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(el.textContent).toContain("前の段落");
    expect(el.textContent).toContain("後ろの段落");
  } finally {
    resetExtensions();
  }
});

// 取り出し元を渡すと見出しの後ろに差分を開くボタンを置き、片付けると取り除く（正常系）
test("test_mount_when_diff_source", async () => {
  // 準備
  const el = createElement();
  const revisionsCalls: string[] = [];
  const diffSource = {
    revisions: async (docId: string) => {
      revisionsCalls.push(docId);
      return [];
    },
    content: async () => "",
  };
  // 実行
  const handle = await mountTracked(el, {
    markdown: "# 見出し\n\n本文",
    docId: "guide",
    diffSource,
  });
  // 検証
  const next = el.querySelector("h1")?.nextElementSibling;
  expect(
    next?.matches(".mdmark-diff-toggle") ||
      next?.querySelector(".mdmark-diff-toggle"),
  ).toBeTruthy();
  expect(revisionsCalls).toEqual([]);
  handle.destroy();
  expect(el.querySelector(".mdmark-diff-toggle")).toBeNull();
});

// 取り出し元を渡して docId が無いと投げる（異常系）
test("test_mount_when_diff_source_without_doc_id", async () => {
  // 準備
  const el = createElement();
  el.innerHTML = "<p>前の中身</p>";
  const diffSource = {
    revisions: async () => [],
    content: async () => "",
  };
  const { mount } = await loadMount();
  // 実行・検証
  expect(() => mount(el, { markdown: "# 見出し", diffSource })).toThrow(
    TypeError,
  );
  expect(el.innerHTML).toBe("<p>前の中身</p>");
});
