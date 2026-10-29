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
  const headings = el.querySelectorAll(".mdmark-content h1");
  expect(headings).toHaveLength(1);
  expect(headings[0]?.textContent).toBe("B");
  expect(el.classList.contains("mdmark")).toBe(true);
});

// update で描き直しても、最初に渡したエイリアスで下線を付ける（正常系）
test("test_mount_when_aliases_updated", async () => {
  // 準備
  const el = createElement();
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      description: "ライブラリ本体の単体テストを流す",
      command: "npm run test:unit",
    },
  ];
  const handle = await mountTracked(el, {
    markdown: "単体テストを流す。",
    aliases,
  });
  // 実行
  handle.update("もう一度単体テストを流す。");
  // 検証
  expect(el.querySelectorAll(".mdmark-term-wrap")).toHaveLength(1);
  expect(el.querySelector(".mdmark-term-tip code")?.textContent).toBe(
    "npm run test:unit",
  );
  expect(el.querySelector("button.mdmark-term-tip-copy")).not.toBeNull();
});

// 選んだテーマを描く先の属性に付け、update でも保ち、destroy で外す（正常系）
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
  const content = el.querySelector(".mdmark-content");
  const next = content?.querySelector("h1")?.nextElementSibling;
  expect(
    next?.matches(".mdmark-diff-toggle") ||
      next?.querySelector(".mdmark-diff-toggle"),
  ).toBeTruthy();
  const toggle = content?.querySelector(".mdmark-diff-toggle");
  const sectionBody = content?.querySelector('[id="section-見出し"]');
  if (!toggle || !sectionBody) {
    throw new Error("差分を開くボタンか節の中身が無い");
  }
  expect(
    toggle.compareDocumentPosition(sectionBody) &
      Node.DOCUMENT_POSITION_FOLLOWING,
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

// コメントの読み書きの関数を渡して docId が無いと投げる（異常系）
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

// 見出しのある文書に右側の目次を置き、記法の操作を本文の列に付ける（正常系）
test("test_mount_when_side_toc", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: `# 手引き\n\n## 導入\n\n${TABLE_MARKDOWN}`,
  });
  // 検証
  expect(el.children).toHaveLength(2);
  expect(el.children[0]?.matches("div.mdmark-content")).toBe(true);
  expect(
    el.children[1]?.matches('aside.mdmark-side-toc[data-mode="hover"]'),
  ).toBe(true);
  const content = el.querySelector(".mdmark-content");
  expect(content?.querySelector("th button")).not.toBeNull();
  expect(content?.querySelector(".mdmark-section-toggle")).not.toBeNull();
});

// 描き直しても右側の目次を 1 つだけ置き、ピン止めを保つ（正常系）
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

// 機能をオフにすると右側の目次を置かず、本文を列に包まない（正常系）
test("test_mount_when_side_toc_off", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: "<!-- features: -side-toc -->\n\n# 手引き\n\n## 導入\n",
  });
  // 検証
  expect(el.querySelector("aside.mdmark-side-toc")).toBeNull();
  expect(el.querySelector("div.mdmark-content")).toBeNull();
  expect(el.querySelector(":scope > h1")).not.toBeNull();
});
