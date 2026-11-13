import { afterEach, expect, test, vi } from "vitest";
import type { MdmarkMarkArgs } from "../../../src/extensions.ts";
import type { MdmarkAlias } from "../../../src/knowledge/aliases.ts";
import type { MountHandle, MountOptions } from "../../../src/mount.ts";
import { INQUIRY_COUNT_TEXT, wrapHtml } from "../helpers/charts.ts";
import { addStyles } from "../helpers/dom.ts";

/** 描く処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMount = () => import("../../../src/mount.ts");

// 閉じた折り畳みを 1 つ持つ文書
const DETAILS_MARKDOWN = "<details><summary>s</summary>b</details>\n";

// 絞り込みを持つ表の文書
const TABLE_MARKDOWN = [
  '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}} -->',
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

/** 描く先の要素を作り、ページに配置する */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** 要素に文書を描き、後始末のために戻り値を記録する */
async function mountTracked(
  el: HTMLElement,
  opts: MountOptions,
): Promise<MountHandle> {
  const { mount } = await loadMount();
  const handle = mount(el, opts);
  handles.push(handle);
  return handle;
}

/** 要素の中の折り畳みを返却する */
function findDetails(el: HTMLElement): HTMLDetailsElement {
  const details = el.querySelector("details");
  if (!details) {
    throw new Error("details が描かれていない");
  }
  return details;
}

/** 印刷の前のイベントを送信する */
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
  history.replaceState(null, "", location.pathname + location.search);
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

// update で本文だけを再描画する（正常系）
test("test_mount_when_updated", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# A" });
  // 実行
  handle.update("# B");
  // 検証
  const headings = el.querySelectorAll(".mdmark-content h1");
  expect(headings).toHaveLength(1);
  expect(headings[0]?.textContent).toBe("B");
  expect(el.classList.contains("mdmark")).toBe(true);
});

// update で再描画しても、最初に指定したエイリアスで下線を付ける（正常系）
test("test_mount_when_aliases_updated", async () => {
  // 準備
  const el = createElement();
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      description: "ライブラリ本体の単体テストを実行する",
      command: "npm run test:unit",
    },
  ];
  const handle = await mountTracked(el, {
    markdown: "単体テストを実行する。",
    aliases,
  });
  // 実行
  handle.update("もう一度単体テストを実行する。");
  // 検証
  expect(el.querySelectorAll(".mdmark-term-wrap")).toHaveLength(1);
  expect(el.querySelector(".mdmark-term-tip code")?.textContent).toBe(
    "npm run test:unit",
  );
  expect(el.querySelector("button.mdmark-term-tip-copy")).not.toBeNull();
});

// 選んだテーマを描く先の属性に付け、update でも保ち、destroy で削除する（正常系）
test("test_mount_when_color_theme", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "# A",
    config: { colorTheme: "theme-slate" },
  });
  const afterMount = el.getAttribute("data-mdmark-color-theme");
  // 実行
  handle.update("# B");
  const afterUpdate = el.getAttribute("data-mdmark-color-theme");
  handle.destroy();
  // 検証
  expect(afterMount).toBe("theme-slate");
  expect(afterUpdate).toBe("theme-slate");
  expect(el.hasAttribute("data-mdmark-color-theme")).toBe(false);
});

// 知らないテーマの名前と省いたときは dev-swiss を付ける（正常系）
test("test_mount_when_color_theme_unknown", async () => {
  // 準備
  const unknownEl = createElement();
  const omittedEl = createElement();
  // 実行
  await mountTracked(unknownEl, {
    markdown: "# A",
    config: { colorTheme: "sepia" },
  });
  await mountTracked(omittedEl, { markdown: "# A" });
  // 検証
  expect(unknownEl.getAttribute("data-mdmark-color-theme")).toBe("dev-swiss");
  expect(omittedEl.getAttribute("data-mdmark-color-theme")).toBe("dev-swiss");
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
  expect(el.querySelectorAll(":scope > .mdmark-content")).toHaveLength(1);
  expect(el.querySelector(".mdmark-content h1")?.textContent).toBe("B");
});

// page のマーカーの明暗・テーマ・目次の出し方を設定より優先し、update でもう一度決める（正常系）
test("test_mount_when_page_marker", async () => {
  // 準備
  const el = createElement();
  const config = {
    colorScheme: "dark",
    colorTheme: "theme-paper",
    "side-toc": { mode: "hover" },
  };
  const markdown = [
    '<!-- page: {"scheme": "light", "theme": "theme-slate", "toc": {"mode": "fixed"}} -->',
    "",
    "## 導入",
    "",
    "段落",
    "",
    "## 使用方法",
    "",
    "段落",
    "",
  ].join("\n");
  // 実行
  const handle = await mountTracked(el, { markdown, config });
  const marked = {
    light: el.classList.contains("mdmark-theme-light"),
    dark: el.classList.contains("mdmark-theme-dark"),
    theme: el.getAttribute("data-mdmark-color-theme"),
    tocMode: el.querySelector(".mdmark-side-toc")?.getAttribute("data-mode"),
  };
  handle.update("## 導入\n\n段落\n\n## 使用方法\n\n段落\n");
  // 検証
  expect(marked).toEqual({
    light: true,
    dark: false,
    theme: "theme-slate",
    tocMode: "fixed",
  });
  expect(el.classList.contains("mdmark-theme-dark")).toBe(true);
  expect(el.classList.contains("mdmark-theme-light")).toBe(false);
  expect(el.getAttribute("data-mdmark-color-theme")).toBe("theme-paper");
  expect(el.querySelector(".mdmark-side-toc")?.getAttribute("data-mode")).toBe(
    "hover",
  );
});

// destroy で mount が付けた明暗の class を削除する（正常系）
test("test_mount_when_color_scheme_destroyed", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "段落\n",
    config: { colorScheme: "dark" },
  });
  // 実行
  handle.destroy();
  // 検証
  expect(el.classList.contains("mdmark-theme-dark")).toBe(false);
  expect(el.classList.contains("mdmark-theme-light")).toBe(false);
});

// 文書のマーカーで印刷の機能を解除すると、印刷の前に折り畳みを開かない（正常系）
test("test_mount_when_print_disabled_by_mark", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: `<!-- features: {"print": false} -->\n\n${DETAILS_MARKDOWN}`,
  });
  // 実行
  sendBeforePrint();
  // 検証
  expect(findDetails(el).open).toBe(false);
});

// update で再描画した文書のマーカーが印刷の機能に有効になる（正常系）
test("test_mount_when_updated_with_print_mark", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "段落\n" });
  handle.update(`<!-- features: {"print": false} -->\n\n${DETAILS_MARKDOWN}`);
  // 実行
  sendBeforePrint();
  // 検証
  expect(findDetails(el).open).toBe(false);
});

// 再描画すると前の操作を削除し、新しい本文に操作を付ける（正常系）
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

/** 範囲で記載した拡張のマーカーを持つ文書 */
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

// 範囲の部品の定義を schema と draw に指定し、定義の JSON を文書に残さない（正常系）
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

// 範囲の部品の定義を JSON として読み込めないときは、schema も load も呼ばず記載の警告にする（異常系）
test("test_mount_when_extension_definition_invalid", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await import(
    "../../../src/extensions.ts"
  );
  resetExtensions();
  const load = vi.fn(async () => ({ draw: () => {} }));
  const validate = vi.fn(() => ({ value: { options: {} } }));
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

/** 手元の mermaid 12.3.0 の ES モジュール（依存の mermaid の dist） */
const MERMAID_URL = "/node_modules/mermaid/dist/mermaid.esm.min.mjs";

/** mermaid の図を描き終えるまでの待ちの上限（全件を並べて実行すると、5MB の mermaid のモジュールの読み込みに 10 秒を超えることがある） */
const MERMAID_WAIT_MS = 60_000;

/** flowchart の mermaid のコードブロックを 1 つ持つ文書 */
const MERMAID_MARKDOWN = [
  "```mermaid",
  "flowchart LR",
  "  A --> B",
  "```",
  "",
].join("\n");

// mermaid のコードブロックを図にし、再描画する前と片付けで mermaid の図を削除する（正常系）
test(
  "test_mount_when_mermaid",
  async () => {
    // 準備
    addStyles();
    const el = createElement();
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const config = { mermaid: { url: MERMAID_URL } };
    const handle = await mountTracked(el, {
      markdown: MERMAID_MARKDOWN,
      config,
    });
    await vi.waitFor(
      () => {
        expect(
          el.querySelectorAll('figure.mdmark-diagram[data-diagram="mermaid"]'),
        ).toHaveLength(1);
      },
      { timeout: MERMAID_WAIT_MS },
    );
    const beforeUpdate = disconnect.mock.calls.length;
    // 実行
    handle.update(MERMAID_MARKDOWN);
    const afterUpdate = disconnect.mock.calls.length;
    handle.destroy();
    // 検証
    expect(afterUpdate).toBeGreaterThan(beforeUpdate);
    expect(disconnect.mock.calls.length).toBeGreaterThan(afterUpdate);
    expect(el.innerHTML).toBe("");
  },
  MERMAID_WAIT_MS + 30_000,
);

// 機能 mermaid をオフにした設定では mermaid を読み込まない（正常系）
test("test_mount_when_mermaid_disabled", async () => {
  // 準備
  const el = createElement();
  const config = {
    features: { mermaid: false },
    mermaid: { url: `${MERMAID_URL}?disabled` },
  };
  // 実行
  await mountTracked(el, { markdown: MERMAID_MARKDOWN, config });
  await new Promise((resolve) => setTimeout(resolve, 200));
  // 検証
  const requested = performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.includes("mermaid.esm.min.mjs?disabled"));
  expect(requested).toHaveLength(0);
  expect(el.querySelector("div.mdmark-code")).not.toBeNull();
});

// 取り出し元を指定すると見出しの後ろに差分を開くボタンを配置し、片付けると取り除く（正常系）
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
  const content = el.querySelector(".mdmark-content");
  const next = content?.querySelector("h1")?.nextElementSibling;
  expect(
    next?.matches(".mdmark-diff-toggle") ||
      next?.querySelector(".mdmark-diff-toggle"),
  ).toBeTruthy();
  const toggle = content?.querySelector(".mdmark-diff-toggle");
  const sectionBody = content?.querySelector('[id="section-見出し"]');
  if (!toggle || !sectionBody) {
    throw new Error("差分を開くボタンかセクションの中身が無い");
  }
  expect(
    toggle.compareDocumentPosition(sectionBody) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(revisionsCalls).toEqual([]);
  handle.destroy();
  expect(el.querySelector(".mdmark-diff-toggle")).toBeNull();
});

// 取り出し元を指定して docId が無いと投げる（異常系）
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

// コメントの読み込みと保存の関数を指定して docId が無いと投げる（異常系）
test("test_mount_when_comment_store_without_doc_id", async () => {
  // 準備
  const el = createElement();
  el.innerHTML = "<p>前の中身</p>";
  const commentStore = {
    load: async () => [],
    save: async () => ({
      id: "c1",
      quote: "a",
      prefix: "",
      suffix: "",
      body: "b",
    }),
  };
  const { mount } = await loadMount();
  // 実行・検証
  expect(() => mount(el, { markdown: "# 見出し", commentStore })).toThrow(
    TypeError,
  );
  expect(el.innerHTML).toBe("<p>前の中身</p>");
});

// 差分の埋め込んだ HTML のプレビューで、図の部品を文書と同じく図に描く（正常系）
test("test_mount_when_diff_html_has_chart", async () => {
  // 準備
  const el = createElement();
  const chart = (text: string) =>
    `# 見出し\n\n${wrapHtml(`<mdmark-chart>\n${text}\n</mdmark-chart>`)}\n`;
  const contents: Record<string, string> = {
    r1: chart(INQUIRY_COUNT_TEXT),
    r2: chart(INQUIRY_COUNT_TEXT.replace("124", "130")),
  };
  const diffSource = {
    revisions: async () => [
      { id: "r2", at: "2026-10-19T07:40:00Z" },
      { id: "r1", at: "2026-10-18T00:12:00Z" },
    ],
    content: async ({ revisionId }: { revisionId: string }) =>
      contents[revisionId] ?? "",
  };
  await mountTracked(el, { markdown: "# 見出し", docId: "guide", diffSource });
  // 実行: 差分を開き、「プレビュー」を押す
  el.querySelector<HTMLButtonElement>(".mdmark-diff-toggle")?.click();
  await vi.waitFor(() => {
    expect(el.querySelector('[data-view="rendered"]')).not.toBeNull();
  });
  el.querySelector<HTMLButtonElement>('[data-view="rendered"]')?.click();
  // 検証: 前と後に図の要素があり、定義の JSON の文字がプレビューに出ない
  const sides = el.querySelector(".mdmark-diff-sides");
  expect(sides?.querySelectorAll(".mdmark-diff-side")).toHaveLength(2);
  expect(sides?.querySelectorAll('figure[data-diagram="chart"]')).toHaveLength(
    2,
  );
  expect(sides?.textContent).not.toContain('"series"');
});

// 差分のプレビューの図も文書と同じく拡大でき、前と後で id が重ならない（正常系）
test("test_mount_when_diff_preview_zoomed", async () => {
  // 準備
  addStyles();
  const el = createElement();
  el.style.width = "600px";
  const chart = (text: string) =>
    `# 見出し\n\n${wrapHtml(`<mdmark-chart>\n${text}\n</mdmark-chart>`)}\n`;
  const contents: Record<string, string> = {
    r1: chart(INQUIRY_COUNT_TEXT),
    r2: chart(INQUIRY_COUNT_TEXT.replace("124", "130")),
  };
  const diffSource = {
    revisions: async () => [
      { id: "r2", at: "2026-10-19T07:40:00Z" },
      { id: "r1", at: "2026-10-18T00:12:00Z" },
    ],
    content: async ({ revisionId }: { revisionId: string }) =>
      contents[revisionId] ?? "",
  };
  await mountTracked(el, { markdown: "# 見出し", docId: "guide", diffSource });
  el.querySelector<HTMLButtonElement>(".mdmark-diff-toggle")?.click();
  await vi.waitFor(() => {
    expect(el.querySelector('[data-view="rendered"]')).not.toBeNull();
  });
  el.querySelector<HTMLButtonElement>('[data-view="rendered"]')?.click();
  const sides = el.querySelectorAll<HTMLElement>(".mdmark-diff-side");
  const after = sides[1] as HTMLElement;
  const zoomText = () =>
    after.querySelector('button[aria-label^="倍率"]')?.textContent ?? "";
  await vi.waitFor(() => {
    expect(zoomText()).toMatch(/%$/);
  });
  const fitted = Number.parseInt(zoomText(), 10);
  // 実行: 後の側の図の拡大のボタンを押す
  after.querySelector<HTMLButtonElement>('button[aria-label="拡大"]')?.click();
  // 検証: 後の側の図の倍率が上がり、id に重なりが無い
  expect(Number.parseInt(zoomText(), 10)).toBeGreaterThan(fitted);
  const ids = [...el.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  const viewport = after.querySelector(
    '[role="group"][aria-roledescription="図"]',
  );
  const labelId = viewport?.getAttribute("aria-labelledby") ?? "";
  expect(after.querySelector(`#${CSS.escape(labelId)}`)).not.toBeNull();
});

// 見出しのある文書に右側の目次を配置し、記法の操作を本文の列に付ける（正常系）
test("test_mount_when_side_toc", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: `# 手引き\n\n## 導入\n\n${TABLE_MARKDOWN}`,
  });
  // 検証
  expect(el.children).toHaveLength(3);
  expect(el.children[0]?.matches("div.mdmark-content")).toBe(true);
  expect(
    el.children[1]?.matches('aside.mdmark-side-toc[data-mode="hover"]'),
  ).toBe(true);
  expect(el.children[2]?.matches("button.mdmark-back-to-top")).toBe(true);
  const content = el.querySelector(".mdmark-content");
  expect(content?.querySelector("th button")).not.toBeNull();
  expect(content?.querySelector(".mdmark-section-toggle")).not.toBeNull();
});

// 再描画しても右側の目次を 1 つだけ配置し、ピン止めを保つ（正常系）
test("test_mount_when_side_toc_kept_on_update", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "# A\n\n## X",
    config: { "side-toc": { mode: "hover" } },
  });
  el.querySelector<HTMLButtonElement>(".mdmark-side-toc-pin")?.click();
  // 実行
  handle.update("# B\n\n## C");
  // 検証
  const asides = el.querySelectorAll("aside.mdmark-side-toc");
  expect(asides).toHaveLength(1);
  expect(asides[0]?.hasAttribute("data-pinned")).toBe(true);
  const hrefs = [...el.querySelectorAll(".mdmark-side-toc-list a")].map(
    (link) => link.getAttribute("href"),
  );
  expect(hrefs).toEqual(["#b", "#c"]);
});

/** セクションの ID の中身の要素を返却する */
function sectionBody(el: HTMLElement, id: string): HTMLElement {
  const body = el.querySelector<HTMLElement>(`[id="section-${id}"]`);
  if (!body) {
    throw new Error(`セクションの中身が無い: ${id}`);
  }
  return body;
}

// 閉じた補足の中に注意を持つ文書
const SECTIONS_MARKDOWN = [
  "## 概要",
  "",
  "概要の段落",
  "",
  "## 補足",
  "",
  '<!-- section: {"open": false} -->',
  "",
  "補足の段落",
  "",
  "### 注意",
  "",
  "注意の段落",
  "",
].join("\n");

// update で描き直しても読者が開閉したセクションの開閉を保ち、#ID で開き直さない（正常系）
test("test_mount_when_sections_kept_on_update", async () => {
  // 準備
  history.replaceState(null, "", "#注意");
  const el = createElement();
  const handle = await mountTracked(el, { markdown: SECTIONS_MARKDOWN });
  for (const id of ["概要", "補足"]) {
    el.querySelector<HTMLButtonElement>(
      `[aria-controls="section-${id}"]`,
    )?.click();
  }
  const updated = `${SECTIONS_MARKDOWN.replace("概要の段落", "書き換えた概要の段落")}\n## 付録\n\n付録の段落\n`;
  // 実行
  handle.update(updated);
  // 検証: 読者が閉じた概要と補足は閉じたまま、追加した付録は開く
  expect(sectionBody(el, "概要").getAttribute("hidden")).toBe("until-found");
  expect(sectionBody(el, "補足").getAttribute("hidden")).toBe("until-found");
  expect(sectionBody(el, "付録").hasAttribute("hidden")).toBe(false);
  // 検証: もう一度 mount すると覚えた開閉を捨て、#注意 で補足を開く
  handle.destroy();
  await mountTracked(el, { markdown: updated });
  expect(sectionBody(el, "概要").hasAttribute("hidden")).toBe(false);
  expect(sectionBody(el, "補足").hasAttribute("hidden")).toBe(false);
});

// update で描き直しても読者が開閉した部品の開閉を保ち、もう一度 mount すると捨てる（正常系）
test("test_mount_when_parts_kept_on_update", async () => {
  // 準備
  const markdown = [
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "",
    '<!-- row-detail: {"at": 2} -->',
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    '<!-- details: {"title": "手順"} -->',
    "",
    "手順の段落",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  const el = createElement();
  const handle = await mountTracked(el, { markdown });
  el.querySelector<HTMLButtonElement>("button.mdmark-row-toggle")?.click();
  const details = el.querySelector<HTMLDetailsElement>(
    "details.mdmark-collapsible",
  );
  details?.querySelector("summary")?.click();
  await new Promise((resolve) =>
    details?.addEventListener("toggle", resolve, { once: true }),
  );
  const updated = markdown
    .replace("詳細の段落", "書き換えた詳細の段落")
    .replace("手順の段落", "書き換えた手順の段落");
  // 実行
  handle.update(updated);
  // 検証: 読者が開いた行の詳細と details は開いたまま
  expect(
    el
      .querySelector<HTMLElement>("tr.mdmark-row-detail")
      ?.hasAttribute("hidden"),
  ).toBe(false);
  expect(
    el.querySelector<HTMLDetailsElement>("details.mdmark-collapsible")?.open,
  ).toBe(true);
  // 検証: もう一度 mount すると覚えた開閉を捨てる
  handle.destroy();
  await mountTracked(el, { markdown: updated });
  expect(
    el
      .querySelector<HTMLElement>("tr.mdmark-row-detail")
      ?.hasAttribute("hidden"),
  ).toBe(true);
  expect(
    el.querySelector<HTMLDetailsElement>("details.mdmark-collapsible")?.open,
  ).toBe(false);
});

// 機能をオフにすると右側の目次を配置せず、本文を列に包まない（正常系）
test("test_mount_when_side_toc_off", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: '<!-- features: {"side-toc": false} -->\n\n# 手引き\n\n## 導入\n',
  });
  // 検証
  expect(el.querySelector("aside.mdmark-side-toc")).toBeNull();
  expect(el.querySelector("div.mdmark-content")).toBeNull();
  expect(el.querySelector(":scope > h1")).not.toBeNull();
});

// 先頭へ戻るボタンを描く先の要素の子の末尾に配置し、再描画しても 1 つだけ配置する（正常系）
test("test_mount_when_back_to_top", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# 手引き\n\n## 導入\n" });
  const afterMount = el.lastElementChild;
  // 実行
  handle.update("# B");
  const afterUpdate = el.lastElementChild;
  const countAfterUpdate = el.querySelectorAll(".mdmark-back-to-top").length;
  handle.destroy();
  // 検証
  expect(afterMount?.matches("button.mdmark-back-to-top[hidden]")).toBe(true);
  expect(afterUpdate?.matches("button.mdmark-back-to-top[hidden]")).toBe(true);
  expect(countAfterUpdate).toBe(1);
  expect(el.querySelector(".mdmark-back-to-top")).toBeNull();
});

// 機能をオフにすると先頭へ戻るボタンを配置しない（正常系）
test("test_mount_when_back_to_top_off", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: '<!-- features: {"back-to-top": false} -->\n\n# 手引き\n',
  });
  // 検証
  expect(el.querySelector("button.mdmark-back-to-top")).toBeNull();
});

/** 通知ブロックの処理を読み込む（blocks で本文を取り出せない通知ブロックを期待値にする） */
const loadNotice = () => import("../../../src/parts/notice.ts");

// 新しい順に並べた 2 つのリビジョン（後 r2・前 r1）
const DIFF_REVISIONS = [
  { id: "r2", at: "2026-10-19T07:40:00Z" },
  { id: "r1", at: "2026-10-18T00:12:00Z" },
];

/** 追加の色で包まれたブロックの最初の段落の文字を、上から順に返却する */
function addedParagraphs(el: HTMLElement): (string | undefined)[] {
  return [...el.querySelectorAll('div.mdmark-diff-block[data-kind="add"]')].map(
    (block) => block.querySelector("p")?.textContent ?? undefined,
  );
}

// open では描いた時点で差分を開き、update の後も開いたままにする（正常系）
test("test_mount_when_diff_mode_open", async () => {
  // 準備
  const el = createElement();
  const revisionsCalls: string[] = [];
  const diffSource = {
    revisions: async (docId: string) => {
      revisionsCalls.push(docId);
      return DIFF_REVISIONS;
    },
    content: async () => "",
  };
  const expanded = () =>
    el.querySelector(".mdmark-diff-toggle")?.getAttribute("aria-expanded");
  // 実行
  const handle = await mountTracked(el, {
    markdown: "# 見出し",
    docId: "guide",
    diffSource,
    diffMode: "open",
  });
  // 検証: 押さずに取り出し元が呼ばれ、開いている
  await vi.waitFor(() => {
    expect(revisionsCalls).toEqual(["guide"]);
  });
  expect(expanded()).toBe("true");
  // 実行
  handle.update("# 次");
  // 検証: 再描画しても開いたままで、取り出し元をもう一度呼ぶ
  await vi.waitFor(() => {
    expect(revisionsCalls).toEqual(["guide", "guide"]);
  });
  expect(expanded()).toBe("true");
});

// blocks ではボタンを配置せず、取り出した 2 つの本文で色分けして再描画する（正常系）
test("test_mount_when_diff_blocks", async () => {
  // 準備
  const el = createElement();
  const before = `# 見出し\n\n既存の段落\n\n${TABLE_MARKDOWN}`;
  const after = `${before}\n追加した段落\n`;
  const contents: Record<string, string> = { r1: before, r2: after };
  const revisionsCalls: string[] = [];
  const contentCalls: { docId: string; revisionId: string }[] = [];
  const diffSource = {
    revisions: async (docId: string) => {
      revisionsCalls.push(docId);
      return DIFF_REVISIONS;
    },
    content: async (target: { docId: string; revisionId: string }) => {
      contentCalls.push(target);
      return contents[target.revisionId] ?? "";
    },
  };
  // 実行
  await mountTracked(el, {
    markdown: after,
    docId: "guide",
    diffSource,
    diffMode: "blocks",
  });
  // 検証: 取り出しを終えた後に、追加した段落が追加の色で包まれる
  await vi.waitFor(() => {
    expect(addedParagraphs(el)).toEqual(["追加した段落"]);
  });
  expect(el.querySelector(".mdmark-diff-toggle")).toBeNull();
  expect(revisionsCalls).toEqual(["guide"]);
  expect(contentCalls.map((call) => call.revisionId).sort()).toEqual([
    "r1",
    "r2",
  ]);
  // 検証: 記法の操作が色分けした本文に付いている
  expect(el.querySelector("button.mdmark-filter")).not.toBeNull();
});

// blocks で mount の直後に描き直す 2 回目の描画でも #ID へ移る（正常系）
test("test_mount_when_diff_blocks_with_hash", async () => {
  // 準備
  history.replaceState(null, "", "#注意");
  const scrolled: Element[] = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (
    this: Element,
  ) {
    scrolled.push(this);
  });
  const el = createElement();
  const after = `${SECTIONS_MARKDOWN}\n追加した段落\n`;
  const contents: Record<string, string> = {
    r1: SECTIONS_MARKDOWN,
    r2: after,
  };
  const diffSource = {
    revisions: async () => DIFF_REVISIONS,
    content: async (target: { docId: string; revisionId: string }) =>
      contents[target.revisionId] ?? "",
  };
  // 実行
  await mountTracked(el, {
    markdown: after,
    docId: "guide",
    diffSource,
    diffMode: "blocks",
  });
  // 検証: 2 回目の描画の後も補足が開き、その描画の注意へ移る
  await vi.waitFor(() => {
    expect(addedParagraphs(el)).toEqual(["追加した段落"]);
  });
  expect(sectionBody(el, "補足").hasAttribute("hidden")).toBe(false);
  expect(scrolled.at(-1)).toBe(el.querySelector('[id="注意"]'));
});

// blocks で update した後に届いた古い取り出しの結果で再描画しない（正常系）
test("test_mount_when_diff_blocks_stale", async () => {
  // 準備: 呼ばれた順に記録し、合図で返却する取り出し元
  const el = createElement();
  const pending: { revisionId: string; resolve: (text: string) => void }[] = [];
  const diffSource = {
    revisions: async () => DIFF_REVISIONS,
    content: ({ revisionId }: { revisionId: string }) =>
      new Promise<string>((resolve) => {
        pending.push({ revisionId, resolve });
      }),
  };
  const base = "# 見出し\n\n最初の段落\n";
  const first = `${base}\n一回目の追加\n`;
  const second = `${base}\n二回目の追加\n`;
  /** 記録した呼び出しに、前は共通の本文、後は指定した本文を返却する */
  const answer = (calls: typeof pending, afterText: string) => {
    for (const call of calls) {
      call.resolve(call.revisionId === "r1" ? base : afterText);
    }
  };
  const handle = await mountTracked(el, {
    markdown: first,
    docId: "guide",
    diffSource,
    diffMode: "blocks",
  });
  await vi.waitFor(() => {
    expect(pending).toHaveLength(2);
  });
  // 実行: 1 回目の本文を待たせたまま update し、2 回目を先に返却してから 1 回目を返却する
  handle.update(second);
  await vi.waitFor(() => {
    expect(pending).toHaveLength(4);
  });
  answer(pending.slice(2), second);
  await vi.waitFor(() => {
    expect(addedParagraphs(el)).toEqual(["二回目の追加"]);
  });
  answer(pending.slice(0, 2), first);
  await new Promise((resolve) => setTimeout(resolve, 50));
  // 検証
  expect(addedParagraphs(el)).toEqual(["二回目の追加"]);
});

// blocks で本文を取り出せなければ、色分けせずに通知ブロックを先頭に配置する（異常系）
test("test_mount_when_diff_blocks_failed", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { renderNotice } = await loadNotice();
  const el = createElement();
  const error = new Error("本文を返却できない");
  const diffSource = {
    revisions: async () => DIFF_REVISIONS,
    content: async () => {
      throw error;
    },
  };
  // 実行: 例外を投げない
  await mountTracked(el, {
    markdown: "# 見出し\n\n本文",
    docId: "guide",
    diffSource,
    diffMode: "blocks",
  });
  // 検証
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-notice")).not.toBeNull();
  });
  const content = el.querySelector(".mdmark-content");
  expect(
    content?.innerHTML.startsWith(
      renderNotice({ name: "guide", source: "diff-blocks" }),
    ),
  ).toBe(true);
  expect(el.querySelector(".mdmark-diff-block")).toBeNull();
  expect(consoleError.mock.calls.flat()).toContain(error);
});

/** 差分のブロックの種類ごとに、包んだ段落の文字を上から順に返却する */
function blockParagraphs(
  el: HTMLElement,
  kind: "add" | "del",
): (string | undefined)[] {
  return [
    ...el.querySelectorAll(`div.mdmark-diff-block[data-kind="${kind}"]`),
  ].map((block) => block.querySelector("p")?.textContent ?? undefined);
}

// 比較元を指定すると、取り出し元なしで変えたブロックを色分けして描く（正常系）
test("test_mount_when_base_markdown", async () => {
  // 準備
  const el = createElement();
  // 実行: 空行どうしで合わないよう、共通の段落 C を 2 行にする
  await mountTracked(el, {
    markdown: "A\n\nB\n\nC1\nC2\n",
    baseMarkdown: "A\n\nC1\nC2\n\nD\n",
  });
  // 検証
  expect(blockParagraphs(el, "add")).toEqual(["B"]);
  expect(blockParagraphs(el, "del")).toEqual(["D"]);
  expect(el.querySelector(".mdmark-diff-toggle")).toBeNull();
});

// 比較元が本文と同じなら色分けしない（正常系）
test("test_mount_when_base_markdown_same", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, { markdown: "# A\n", baseMarkdown: "# A\n" });
  // 検証
  expect(el.querySelector(".mdmark-diff-block")).toBeNull();
});

// update で比較元を差し替え、省くと前の比較元のまま、null で削除する（正常系）
test("test_mount_when_base_replaced", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "A\n",
    baseMarkdown: "A\n\nB\n",
  });
  // 実行・検証: 比較元を差し替える
  handle.update("A\n\nC\n", { baseMarkdown: "A\n" });
  expect(blockParagraphs(el, "add")).toEqual(["C"]);
  // 実行・検証: 省くと前の比較元のまま
  handle.update("A\n\nD\n");
  expect(blockParagraphs(el, "add")).toEqual(["D"]);
  // 実行・検証: null で削除する
  handle.update("A\n\nD\n", { baseMarkdown: null });
  expect(el.querySelector(".mdmark-diff-block")).toBeNull();
});

// 比較元と取り出し元を両方渡すと、色分けに比較元を使用し、取り出し元は差分を開く UI にだけ使用する（正常系）
test("test_mount_when_base_with_diff_source", async () => {
  // 準備
  const calls: string[] = [];
  const diffSource = {
    revisions: async (docId: string) => {
      calls.push(`revisions:${docId}`);
      return DIFF_REVISIONS;
    },
    content: async ({ revisionId }: { revisionId: string }) => {
      calls.push(`content:${revisionId}`);
      return "";
    },
  };
  const blocksEl = createElement();
  const buttonEl = createElement();
  const options = {
    markdown: "A\n\nB\n",
    baseMarkdown: "A\n",
    docId: "guide",
    diffSource,
  };
  // 実行
  await mountTracked(blocksEl, { ...options, diffMode: "blocks" });
  await mountTracked(buttonEl, { ...options, diffMode: "button" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  // 検証
  expect(blockParagraphs(blocksEl, "add")).toEqual(["B"]);
  expect(blockParagraphs(buttonEl, "add")).toEqual(["B"]);
  expect(buttonEl.querySelector(".mdmark-diff-toggle")).not.toBeNull();
  expect(calls).toEqual([]);
});

// 比較元が文字列でも null でもないと投げる（異常系）
test("test_mount_when_base_not_string", async () => {
  // 準備
  const { mount } = await loadMount();
  const el = createElement();
  el.innerHTML = "<p>前の中身</p>";
  const updated = createElement();
  const handle = await mountTracked(updated, { markdown: "# A" });
  // 実行・検証: mount
  expect(() =>
    mount(el, { markdown: "# A", baseMarkdown: 1 as unknown as string }),
  ).toThrow(TypeError);
  expect(() =>
    mount(el, { markdown: "# A", baseMarkdown: 1 as unknown as string }),
  ).toThrow("baseMarkdown");
  expect(el.innerHTML).toBe("<p>前の中身</p>");
  // 実行・検証: update
  expect(() =>
    handle.update("# B", { baseMarkdown: 1 as unknown as string }),
  ).toThrow(TypeError);
  expect(() =>
    handle.update("# B", { baseMarkdown: 1 as unknown as string }),
  ).toThrow("baseMarkdown");
  expect(updated.querySelector("h1")?.textContent).toBe("A");
});

// 列の表示の通知が関数でないと投げる（異常系）
test("test_mount_when_columns_callback_not_function", async () => {
  // 準備
  const { mount } = await loadMount();
  const el = createElement();
  el.innerHTML = "<p>前の中身</p>";
  const opts = {
    markdown: "# A",
    onColumnsChange: "x" as unknown as MountOptions["onColumnsChange"],
  };
  // 実行・検証
  expect(() => mount(el, opts)).toThrow(TypeError);
  expect(() => mount(el, opts)).toThrow("onColumnsChange");
  expect(el.innerHTML).toBe("<p>前の中身</p>");
});

// 列の表示を切り替えると通知し、描いたときと update では通知しない（正常系）
test("test_mount_when_columns_changed", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"説明": {"hidden": true}}} -->',
    "",
    "| 名前 | 状態 | 説明 |",
    "| --- | --- | --- |",
    "| a | 完了 | 一つ目 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  const onColumnsChange = vi.fn();
  const handle = await mountTracked(el, { markdown, onColumnsChange });
  // 実行・検証: 描いたときと update では呼ばない
  handle.update(markdown);
  expect(onColumnsChange).not.toHaveBeenCalled();
  // 実行: テーブル設定で `状態` を目のアイコンで隠す
  el.querySelector<HTMLButtonElement>(
    "button.mdmark-table-settings-toggle",
  )?.click();
  el.querySelectorAll<HTMLButtonElement>(
    ".mdmark-table-settings button.mdmark-table-settings-eye",
  )[1]?.click();
  // 検証
  expect(onColumnsChange).toHaveBeenCalledTimes(1);
  expect(onColumnsChange).toHaveBeenCalledWith({
    tableIndex: 0,
    hidden: ["状態", "説明"],
  });
});

// 読み込みと保存の関数の update・remove が関数でないと投げる（異常系）
test("test_mount_when_comment_store_edit_invalid", async () => {
  // 準備
  const { mount } = await loadMount();
  const el = createElement();
  el.innerHTML = "<p>前の中身</p>";
  const commentStore = {
    load: async () => [],
    save: async () => ({
      id: "c1",
      quote: "a",
      prefix: "",
      suffix: "",
      body: "b",
    }),
    update: 1,
  } as unknown as MountOptions["commentStore"];
  // 実行・検証
  expect(() =>
    mount(el, { markdown: "# A", docId: "guide", commentStore }),
  ).toThrow(TypeError);
  expect(() =>
    mount(el, { markdown: "# A", docId: "guide", commentStore }),
  ).toThrow("commentStore");
  expect(el.innerHTML).toBe("<p>前の中身</p>");
});

/** 部品のモジュールを読み込む処理を読み込む */
const loadPartModules = () => import("../../../src/part-modules.ts");

/** 代役のコメントのモジュールが呼ばれたことを記録する場所（グローバル） */
declare global {
  var __mdmarkMountCommentsTest:
    | { reload: number; focus: string[] }
    | undefined;
}

// reloadComments・focusComment を今の描画の部品に任せ、destroy の後は呼ばない（正常系）
test("test_mount_when_comments_delegated", async () => {
  // 準備
  const recorder = { reload: 0, focus: [] as string[] };
  globalThis.__mdmarkMountCommentsTest = recorder;
  const { partModules, partModuleLoaders, setPartModuleLoader } =
    await loadPartModules();
  partModules.clear();
  const url = URL.createObjectURL(
    new Blob(
      [
        `const rec = globalThis.__mdmarkMountCommentsTest;
export async function attachComments() {
  return {
    detach: () => {},
    reload: async () => { rec.reload += 1; },
    focus: (id) => { rec.focus.push(id); },
  };
}`,
      ],
      { type: "text/javascript" },
    ),
  );
  setPartModuleLoader("comments", () => import(/* @vite-ignore */ url));
  try {
    const el = createElement();
    const handle = await mountTracked(el, {
      markdown: "本文",
      config: { features: { comments: true } },
      docId: "guide",
      commentStore: { load: async () => [], save: vi.fn() },
    });
    // 実行
    await handle.reloadComments();
    handle.focusComment("c1");
    handle.destroy();
    await handle.reloadComments();
    handle.focusComment("c1");
    // 検証
    expect(recorder.reload).toBe(1);
    expect(recorder.focus).toEqual(["c1"]);
  } finally {
    partModules.clear();
    partModuleLoaders.clear();
    URL.revokeObjectURL(url);
    globalThis.__mdmarkMountCommentsTest = undefined;
  }
});

// 文字列・null・undefined は経由する（正常系）
test("test_check_base_markdown", async () => {
  // 準備
  const { checkBaseMarkdown } = await loadMount();
  // 実行・検証
  for (const value of ["# A", "", null, undefined]) {
    expect(() => checkBaseMarkdown(value)).not.toThrow();
  }
});

// それ以外は投げる（異常系）
test("test_check_base_markdown_when_invalid", async () => {
  // 準備
  const { checkBaseMarkdown } = await loadMount();
  // 実行・検証
  for (const value of [1, {}]) {
    expect(() => checkBaseMarkdown(value)).toThrow(TypeError);
    expect(() => checkBaseMarkdown(value)).toThrow("baseMarkdown");
  }
});

/** 根の要素に `data-ran` を付ける `js` の範囲のコード */
const RANGE_SCRIPT_CODE =
  'export default (root) => { root.dataset.ran = "1"; };';

// 描くたびに範囲のスクリプトを動かし、再描画する前と `destroy` で範囲の `destroy` を呼ぶ（正常系）
test("test_mount_when_range_scripts", async () => {
  // 準備
  const { setEmbeddedHtmlScripts } = await import(
    "../../../src/html-scripts.ts"
  );
  let destroyed = 0;
  setEmbeddedHtmlScripts(
    new Map([
      [
        `${RANGE_SCRIPT_CODE}\n`,
        () => (root: HTMLElement) => {
          root.dataset.ran = "1";
          return () => {
            destroyed += 1;
          };
        },
      ],
    ]),
  );
  const el = createElement();
  const markdown = [
    "<!-- html -->",
    "",
    "```html",
    "<p>範囲</p>",
    "```",
    "",
    "```js",
    RANGE_SCRIPT_CODE,
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
  try {
    // 実行・検証: 描いた後に動く
    const handle = await mountTracked(el, {
      markdown,
      config: { features: { "html-scripts": true } },
    });
    await vi.waitFor(() => {
      expect(
        el.querySelector<HTMLElement>("div.mdmark-html")?.dataset.ran,
      ).toBe("1");
    });
    // 実行・検証: 再描画する前に呼ぶ
    handle.update(markdown);
    expect(destroyed).toBe(1);
    await vi.waitFor(() => {
      expect(
        el.querySelector<HTMLElement>("div.mdmark-html")?.dataset.ran,
      ).toBe("1");
    });
    // 実行・検証: 片付けで呼ぶ
    handle.destroy();
    expect(destroyed).toBe(2);
  } finally {
    setEmbeddedHtmlScripts(undefined);
  }
});
