import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { resolveConfig } from "../../../src/config.ts";
import type { SyntaxImport } from "../../../src/highlight.ts";
import { addStyles, createRootFromHtml, removeRoots } from "../helpers/dom.ts";

/** mermaid の処理を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む） */
const loadMermaid = (): Promise<typeof import("../../../src/mermaid.ts")> =>
  import(
    /* @vite-ignore */ new URL("../../../src/mermaid.ts", import.meta.url).href
  );

/** 手元の mermaid 12.3.0 の ES モジュール（依存の mermaid の dist） */
const MERMAID_MODULE_URL = "/node_modules/mermaid/dist/mermaid.esm.min.mjs";

/** mermaid のモジュールを読む */
const importMermaid = (): Promise<{ default?: unknown }> =>
  import(/* @vite-ignore */ MERMAID_MODULE_URL);

/** front matter の title を持つ flowchart のソース */
const FLOWCHART = [
  "---",
  "title: 問い合わせの受付",
  "---",
  "flowchart LR",
  "  A[問い合わせを受ける] --> B{担当がいるか}",
  "  B -->|いる| C[担当へ回す]",
].join("\n");

/** actor を持つ sequenceDiagram のソース */
const SEQUENCE = [
  "sequenceDiagram",
  "  actor U as 読む人",
  "  participant M as mdmark",
  "  U->>M: ページを開く",
].join("\n");

/** gantt のソース */
const GANTT = [
  "gantt",
  "  dateFormat YYYY-MM-DD",
  "  section 設計",
  "  単一ユースケース :done, a1, 2026-11-01, 3d",
].join("\n");

/** 図の種類の行を持たない、解釈できないソース */
const INVALID = "問い合わせを受ける --> 担当へ回す";

/** HTML の特別な文字をエスケープする */
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** `render` が出す形の mermaid のコードブロックの HTML */
const codeBlock = (source: string): string =>
  `<div class="mdmark-code" data-mdmark-mermaid><div class="mdmark-code-bar"></div><pre tabindex="0" aria-label="コード: mermaid"><code class="language-mermaid">${escapeHtml(source)}</code></pre></div>`;

/** mermaid のコードブロックを並べた描く先の要素を置く */
const createMermaidRoot = (
  sources: string[] = [FLOWCHART, SEQUENCE],
): HTMLElement => createRootFromHtml(sources.map(codeBlock).join(""));

/** `css` の色の値を、試しの要素の color で rgb() の文字にする */
const computedColor = (scope: HTMLElement, value: string): string => {
  const probe = document.createElement("span");
  probe.style.color = value;
  scope.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
};

/** rgb() の文字を #rrggbb にする */
const rgbToHex = (rgb: string): string => {
  const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number);
  return `#${[r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`;
};

/** attachMermaid に渡す引数を作る */
const attachOptions = (
  root: HTMLElement,
  overrides: { importModule?: SyntaxImport; isCurrent?: () => boolean } = {},
) => ({
  root,
  scope: root,
  config: resolveConfig({}),
  mountId: 1,
  isCurrent: overrides.isCurrent ?? (() => true),
  modules: new Map<string, Promise<{ default?: unknown }>>(),
  placement: "bottom" as const,
  importModule: overrides.importModule ?? vi.fn<SyntaxImport>(importMermaid),
});

const detachers: Array<() => void> = [];

// 全件を並べて流すと、5MB の mermaid のモジュールの読み込みに既定の 15 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  addStyles();
});

afterEach(async () => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  document.body.classList.remove("mdmark-theme-dark", "x");
  const { setEmbeddedMermaid } = await loadMermaid();
  setEmbeddedMermaid(undefined);
  vi.restoreAllMocks();
});

// 読み込みの間は読み込み中の枠を置き、描いたら図の枠に置き換えて操作を付ける（正常系）
test("test_attach_mermaid", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const importModule = vi.fn<SyntaxImport>(async () => {
    await gate;
    return importMermaid();
  });
  // 実行
  const handle = attachMermaid(attachOptions(root, { importModule }));
  detachers.push(handle.detach);
  // 検証: 止めている間
  expect(
    root.querySelectorAll('div.mdmark-embed[data-mdmark-slot="mermaid"]'),
  ).toHaveLength(2);
  for (const block of root.querySelectorAll<HTMLElement>(
    "[data-mdmark-mermaid]",
  )) {
    expect(block.hidden).toBe(true);
  }
  release();
  await handle.ready;
  // 検証: 描いた後
  const figures = [
    ...root.querySelectorAll<HTMLElement>(
      'figure.mdmark-diagram[data-diagram="mermaid"]',
    ),
  ];
  expect(figures).toHaveLength(2);
  expect(figures[0]?.querySelector("figcaption")?.textContent?.trim()).toBe(
    "問い合わせの受付",
  );
  expect(figures[1]?.querySelector("figcaption")?.textContent?.trim()).toBe(
    "シーケンス図",
  );
  expect(root.querySelector(".mdmark-embed")).toBeNull();
  expect(root.querySelector("[data-mdmark-mermaid]")).toBeNull();
  expect(
    figures[0]?.querySelector('button[aria-label^="倍率"]'),
  ).not.toBeNull();
  expect(importModule).toHaveBeenCalledTimes(1);
});

// 対象が無ければ何も読まない（正常系）
test("test_attach_mermaid_when_no_target", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createRootFromHtml(
    '<pre><code class="language-ts">const a = 1;</code></pre>',
  );
  const importModule = vi.fn<SyntaxImport>(importMermaid);
  // 実行
  const handle = attachMermaid(attachOptions(root, { importModule }));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  expect(importModule).not.toHaveBeenCalled();
});

// 読めないときは知らせの枠に替えてコードブロックを出す（異常系）
test("test_attach_mermaid_when_unavailable", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot();
  const error = new Error("404");
  const importModule = vi.fn<SyntaxImport>(async () => {
    throw error;
  });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  // 実行
  const handle = attachMermaid(attachOptions(root, { importModule }));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  const blocks = [
    ...root.querySelectorAll<HTMLElement>("[data-mdmark-mermaid]"),
  ];
  expect(blocks).toHaveLength(2);
  for (const block of blocks) {
    expect(block.hidden).toBe(false);
    expect(
      block.previousElementSibling?.classList.contains("mdmark-notice"),
    ).toBe(true);
  }
  expect(root.querySelector(".mdmark-embed")).toBeNull();
  const logged = consoleError.mock.calls.flat();
  expect(logged.some((value) => String(value).includes("mermaid"))).toBe(true);
  expect(logged).toContain(error);
});

// 解釈できないソースは書き方の警告に替え、ほかは描く（異常系）
test("test_attach_mermaid_when_syntax_invalid", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot([INVALID, FLOWCHART]);
  // 実行
  const handle = attachMermaid(attachOptions(root));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  const block = root.querySelector<HTMLElement>("[data-mdmark-mermaid]");
  const warning = block?.previousElementSibling;
  expect(warning?.classList.contains("mdmark-syntax-warning")).toBe(true);
  expect(warning?.textContent).toContain("mermaid の図を描けません（");
  expect(
    root.querySelectorAll('figure.mdmark-diagram[data-diagram="mermaid"]'),
  ).toHaveLength(1);
  expect(document.querySelector('[id^="dmdmark-mermaid"]')).toBeNull();
});

// 読み終えたときに描き直していたら何もしない（正常系）
test("test_attach_mermaid_when_stale", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot();
  const mermaid = (await importMermaid()).default as {
    render: (...args: unknown[]) => unknown;
  };
  const render = vi.spyOn(mermaid, "render");
  // 実行
  const handle = attachMermaid(attachOptions(root, { isCurrent: () => false }));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  expect(root.querySelector("figure.mdmark-diagram")).toBeNull();
  expect(render).not.toHaveBeenCalled();
});

// 埋めたモジュールがあれば URL を読まない（正常系）
test("test_attach_mermaid_when_embedded", async () => {
  // 準備
  const { attachMermaid, setEmbeddedMermaid } = await loadMermaid();
  setEmbeddedMermaid(await importMermaid());
  const root = createMermaidRoot();
  const importModule = vi.fn<SyntaxImport>(importMermaid);
  // 実行
  const handle = attachMermaid(attachOptions(root, { importModule }));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  expect(importModule).not.toHaveBeenCalled();
  expect(
    root.querySelectorAll('figure.mdmark-diagram[data-diagram="mermaid"]'),
  ).toHaveLength(2);
});

// 埋めたモジュールが mermaid を持たなければ、外へ読まずに知らせの枠にする（異常系）
test("test_attach_mermaid_when_embedded_without_module", async () => {
  // 準備
  const { attachMermaid, setEmbeddedMermaid } = await loadMermaid();
  setEmbeddedMermaid({});
  const root = createMermaidRoot();
  const importModule = vi.fn<SyntaxImport>(importMermaid);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  // 実行
  const handle = attachMermaid(attachOptions(root, { importModule }));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  expect(importModule).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
  for (const block of root.querySelectorAll<HTMLElement>(
    "[data-mdmark-mermaid]",
  )) {
    expect(
      block.previousElementSibling?.classList.contains("mdmark-notice"),
    ).toBe(true);
  }
});

// 祖先の明暗の class が変わったら描き直し、変わらなければ描き直さない（正常系）
test("test_attach_mermaid_when_scheme_changed", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot([FLOWCHART]);
  const mermaid = (await importMermaid()).default as {
    render: (...args: unknown[]) => unknown;
  };
  const render = vi.spyOn(mermaid, "render");
  const handle = attachMermaid(attachOptions(root));
  detachers.push(handle.detach);
  await handle.ready;
  const before = render.mock.calls.length;
  // 実行: 暗い配色にする
  document.body.classList.add("mdmark-theme-dark");
  await vi.waitFor(() => {
    expect(render.mock.calls.length).toBe(before + 2);
  });
  await vi.waitFor(() => {
    const node = root.querySelector<SVGElement>(
      ".mdmark-mermaid > svg g.node rect, .mdmark-mermaid > svg g.node path",
    );
    expect(node).not.toBeNull();
    expect(getComputedStyle(node as Element).fill).toBe(
      computedColor(root, "var(--mdmark-color-surface)"),
    );
  });
  const afterDark = render.mock.calls.length;
  // 実行: 明暗に関わらない class を付ける
  document.body.classList.add("x");
  await new Promise((resolve) => setTimeout(resolve, 100));
  // 検証
  expect(render.mock.calls.length).toBe(afterDark);
});

// 外すと明暗が変わっても描き直さない（正常系）
test("test_attach_mermaid_when_detached", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot([FLOWCHART]);
  const mermaid = (await importMermaid()).default as {
    render: (...args: unknown[]) => unknown;
  };
  const render = vi.spyOn(mermaid, "render");
  const handle = attachMermaid(attachOptions(root));
  await handle.ready;
  const before = render.mock.calls.length;
  const zoom = root.querySelector<HTMLButtonElement>(
    'button[aria-label^="倍率"]',
  );
  const zoomTextBefore = zoom?.textContent;
  // 実行
  handle.detach();
  document.body.classList.add("mdmark-theme-dark");
  await new Promise((resolve) => setTimeout(resolve, 100));
  root.querySelector<HTMLButtonElement>('button[aria-label="拡大"]')?.click();
  // 検証
  expect(render.mock.calls.length).toBe(before);
  expect(zoom?.textContent).toBe(zoomTextBefore);
});

/** drawMermaidDiagram に渡す引数を作る */
const drawOptions = async (
  scope: HTMLElement,
  source: string,
  config = resolveConfig({}).mermaid,
) => ({
  mermaid: (await importMermaid())
    .default as import("../../../src/mermaid.ts").MermaidModule,
  source,
  root: scope,
  scope,
  config,
  id: `mdmark-mermaid-t-${Math.random().toString(36).slice(2)}`,
  frameId: "f1",
});

/** 返った HTML を描く先の要素に入れる */
const place = (scope: HTMLElement, html: string): void => {
  scope.innerHTML = html;
};

// 明るい配色では SVG を 1 つだけ置き、固定の初期化の設定で描く（正常系）
test("test_draw_mermaid_diagram", async () => {
  // 準備
  const { drawMermaidDiagram } = await loadMermaid();
  const scope = createRootFromHtml("");
  const options = await drawOptions(scope, FLOWCHART);
  const initialize = vi.spyOn(options.mermaid, "initialize");
  // 実行
  const result = await drawMermaidDiagram(options);
  // 検証
  if (!("html" in result)) {
    throw new Error(`描けなかった: ${result.error}`);
  }
  place(scope, result.html);
  expect(scope.querySelectorAll("svg[id]")).toHaveLength(1);
  expect(scope.querySelector(".mdmark-mermaid-print")).toBeNull();
  expect(initialize).toHaveBeenCalledTimes(1);
  const config = initialize.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(config.startOnLoad).toBe(false);
  expect(config.securityLevel).toBe("strict");
  expect(config.theme).toBe("base");
  const variables = config.themeVariables as Record<string, unknown>;
  expect(variables.useGradient).toBe(false);
  expect(variables.dropShadow).toBe("none");
  for (const shape of scope.querySelectorAll<SVGElement>(
    "g.node rect, g.node path",
  )) {
    expect(getComputedStyle(shape).stroke.startsWith("url(")).toBe(false);
  }
});

// 暗い配色では明るい配色の図も描いて並べ、描く先の class を戻す（正常系）
test("test_draw_mermaid_diagram_when_dark", async () => {
  // 準備
  const { drawMermaidDiagram } = await loadMermaid();
  const scope = createRootFromHtml("");
  scope.classList.add("mdmark-theme-dark");
  const lightSurface = (() => {
    scope.classList.replace("mdmark-theme-dark", "mdmark-theme-light");
    const color = rgbToHex(computedColor(scope, "var(--mdmark-color-surface)"));
    scope.classList.replace("mdmark-theme-light", "mdmark-theme-dark");
    return color;
  })();
  const options = await drawOptions(scope, FLOWCHART);
  const initialize = vi.spyOn(options.mermaid, "initialize");
  // 実行
  const result = await drawMermaidDiagram(options);
  // 検証
  if (!("html" in result)) {
    throw new Error(`描けなかった: ${result.error}`);
  }
  expect([...scope.classList]).toEqual(["mdmark", "mdmark-theme-dark"]);
  place(scope, result.html);
  expect(scope.querySelectorAll("svg[id]")).toHaveLength(2);
  const print = scope.querySelector(".mdmark-mermaid-print");
  expect(print?.getAttribute("aria-hidden")).toBe("true");
  expect(print?.querySelector("svg")).not.toBeNull();
  expect(initialize).toHaveBeenCalledTimes(2);
  const second = initialize.mock.calls[1]?.[0] as {
    themeVariables: Record<string, unknown>;
  };
  expect(second.themeVariables.primaryColor).toBe(lightSurface);
});

// mermaid のテーマを選び、変数を重ね、固定の値は変えさせない（正常系）
test("test_draw_mermaid_diagram_when_theme_configured", async () => {
  // 準備
  const { drawMermaidDiagram } = await loadMermaid();
  const scope = createRootFromHtml("");
  const config = resolveConfig({
    config: {
      mermaid: {
        theme: "neutral",
        themeVariables: { primaryColor: "#e0f2f1", useGradient: "true" },
      },
    },
  }).mermaid;
  const options = await drawOptions(scope, FLOWCHART, config);
  const initialize = vi.spyOn(options.mermaid, "initialize");
  // 実行
  await drawMermaidDiagram(options);
  // 検証
  const called = initialize.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(called.theme).toBe("neutral");
  expect(called.themeVariables).toEqual({
    primaryColor: "#e0f2f1",
    useGradient: false,
    dropShadow: "none",
  });
});

// 解釈できないソースはエラーの 1 行目を返し、エラーの図を消す（異常系）
test("test_draw_mermaid_diagram_when_invalid", async () => {
  // 準備
  const { drawMermaidDiagram } = await loadMermaid();
  const scope = createRootFromHtml("");
  const options = await drawOptions(scope, INVALID);
  // 実行
  const result = await drawMermaidDiagram(options);
  // 検証
  if (!("error" in result)) {
    throw new Error("描けてしまった");
  }
  expect(result.error).not.toContain("\n");
  expect(document.getElementById(`d${options.id}`)).toBeNull();
});

// ガントチャートは 720px より狭い描く先でも 720px で描く（正常系）
test("test_draw_mermaid_diagram_when_gantt", async () => {
  // 準備
  const { drawMermaidDiagram } = await loadMermaid();
  const scope = createRootFromHtml("");
  scope.style.width = "400px";
  const options = await drawOptions(scope, GANTT);
  const initialize = vi.spyOn(options.mermaid, "initialize");
  // 実行
  const result = await drawMermaidDiagram(options);
  // 検証
  const called = initialize.mock.calls[0]?.[0] as {
    gantt: { useWidth: number };
  };
  expect(called.gantt.useWidth).toBe(720);
  if (!("html" in result)) {
    throw new Error(`描けなかった: ${result.error}`);
  }
  place(scope, result.html);
  expect(scope.querySelector("figure")?.getAttribute("data-fit-min")).toBe(
    "0.75",
  );
});

/** ページの CSS から、セレクタに `_end` を含む規則のセレクタを、入れ子の親のセレクタを重ねた形で集める */
const endMarkerSelectors = (): string[] => {
  const found: string[] = [];
  /** 入れ子の規則のセレクタに親のセレクタを重ねる（`&` があれば置き換え、無ければ子孫にする） */
  const nest = (parent: string, child: string): string =>
    parent === ""
      ? child
      : child.includes("&")
        ? child.replaceAll("&", `:is(${parent})`)
        : `:is(${parent}) ${child}`;
  const walk = (rules: CSSRuleList, parent: string): void => {
    for (const rule of rules) {
      const selector =
        rule instanceof CSSStyleRule ? nest(parent, rule.selectorText) : parent;
      if (rule instanceof CSSStyleRule && rule.selectorText.includes("_end")) {
        found.push(selector);
      }
      if ("cssRules" in rule) {
        walk((rule as CSSGroupingRule).cssRules, selector);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    walk(sheet.cssRules, "");
  }
  return found;
};

// 名前に _end を含むノードと状態は本文の色にせず、状態遷移図の終了の印だけを本文の色にする（正常系）
test("test_draw_mermaid_diagram_when_end_in_name", async () => {
  // 準備
  const { drawMermaidDiagram } = await loadMermaid();
  const scope = createRootFromHtml("");
  const text = computedColor(scope, "var(--mdmark-color-text)");
  const flowchart = await drawOptions(
    scope,
    "flowchart LR\n  job_end[(記録)] --> B[次]",
  );
  const state = await drawOptions(
    scope,
    "stateDiagram-v2\n  [*] --> 受付_end\n  受付_end --> [*]",
  );
  // 実行
  const results = [
    await drawMermaidDiagram(flowchart),
    await drawMermaidDiagram(state),
  ];
  // 検証
  const html = results.map((result) => {
    if (!("html" in result)) {
      throw new Error(`描けなかった: ${result.error}`);
    }
    return result.html;
  });
  place(scope, html.join(""));
  const shapes = (selector: string) => [
    ...scope.querySelectorAll<SVGElement>(
      `${selector} :is(rect, path, polygon)`,
    ),
  ];
  const named = [
    ...shapes('g.node[id*="-flowchart-job_end-"]'),
    ...shapes('g.node.statediagram-state[id*="受付_end"]'),
  ];
  expect(named.length).toBeGreaterThan(0);
  // 終了の印の規則（セレクタに `_end` を含む規則）が、名前に _end を含むノードと状態の形に当たらない
  const endRules = endMarkerSelectors();
  expect(endRules.length).toBeGreaterThan(0);
  for (const shape of named) {
    for (const selector of endRules) {
      expect(shape.matches(selector)).toBe(false);
    }
    expect(getComputedStyle(shape).fill).not.toBe(text);
  }
  const endMarker = scope.querySelector<SVGElement>(
    'g.node.default[id*="_end-"] > g:last-child path',
  );
  expect(endMarker).not.toBeNull();
  expect(getComputedStyle(endMarker as SVGElement).fill).toBe(text);
});

// 表示する枠より小さい図を、枠の中で横の中央に置く（正常系）
test("test_attach_mermaid_when_small", async () => {
  // 準備
  const { attachMermaid } = await loadMermaid();
  const root = createMermaidRoot(["flowchart LR\n  A --> B"]);
  root.style.width = "1000px";
  // 実行
  const handle = attachMermaid(attachOptions(root));
  detachers.push(handle.detach);
  await handle.ready;
  // 検証
  const viewport = root.querySelector<HTMLElement>(".mdmark-diagram-viewport");
  const sizer = root.querySelector<HTMLElement>(".mdmark-diagram-sizer");
  if (!viewport || !sizer) {
    throw new Error("図の枠が無い");
  }
  const left =
    sizer.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
  const right =
    viewport.getBoundingClientRect().right -
    sizer.getBoundingClientRect().right;
  expect(sizer.offsetWidth).toBeLessThan(viewport.clientWidth);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
});

// 対応表の変数を全て hex にし、固定の値を重ねる（正常系）
test("test_mermaid_theme_variables", async () => {
  // 準備
  const { mermaidThemeVariables } = await loadMermaid();
  const { MERMAID_THEME_COLORS } = await import(
    /* @vite-ignore */ new URL(
      "../../../src/mermaid-source.ts",
      import.meta.url,
    ).href
  );
  const scope = createRootFromHtml("");
  // 実行
  const variables = mermaidThemeVariables({
    scope,
    config: resolveConfig({}).mermaid,
  });
  // 検証
  for (const key of Object.keys(MERMAID_THEME_COLORS)) {
    expect(variables[key]).toMatch(/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/);
  }
  expect(variables.primaryColor).toBe(
    rgbToHex(computedColor(scope, "var(--mdmark-color-surface)")),
  );
  expect(variables.useGradient).toBe(false);
  expect(variables.dropShadow).toBe("none");
  expect(variables.pieOpacity).toBe("1");
  expect(variables.fontFamily).toBe(
    getComputedStyle(scope).getPropertyValue("--mdmark-font-body").trim(),
  );
});

// mermaid のテーマでは CSS 変数を使わず、設定の文字列の値と固定の値だけにする（正常系）
test("test_mermaid_theme_variables_when_other_theme", async () => {
  // 準備
  const { mermaidThemeVariables } = await loadMermaid();
  const scope = createRootFromHtml("");
  const config = resolveConfig({
    config: {
      mermaid: {
        theme: "dark",
        themeVariables: { lineColor: "#ff0000", fontSize: 14 },
      },
    },
  }).mermaid;
  // 実行
  const variables = mermaidThemeVariables({ scope, config });
  // 検証
  expect(variables).toEqual({
    lineColor: "#ff0000",
    useGradient: false,
    dropShadow: "none",
  });
});

// rgb・rgba は丸めずに読み、color-mix の値も hex にする（正常系）
test("test_css_color_to_hex", async () => {
  // 準備
  const { cssColorToHex } = await loadMermaid();
  const scope = createRootFromHtml("");
  scope.style.setProperty("--a", "rgb(24 24 27)");
  scope.style.setProperty("--b", "rgba(24, 24, 27, 0.14)");
  scope.style.setProperty("--c", "color-mix(in oklab, #0f766e 50%, #ffffff)");
  // 実行
  const values = ["--a", "--b", "--c"].map((name) =>
    cssColorToHex({ scope, name }),
  );
  // 検証
  expect(values[0]).toBe("#18181b");
  expect(values[1]).toBe("#18181b24");
  expect(values[2]).toMatch(/^#[0-9a-f]{6}$/);
  expect(scope.querySelector("span")).toBeNull();
});

// 棒人間を lucide の人のアイコンに替え、名前の文字は残す（正常系）
test("test_replace_mermaid_actors", async () => {
  // 準備
  const { replaceMermaidActors } = await loadMermaid();
  const host = createRootFromHtml(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
      '<g class="actor-man">',
      '<line x1="60" y1="30" x2="90" y2="30"></line>',
      '<line x1="75" y1="30" x2="75" y2="45"></line>',
      '<line x1="75" y1="45" x2="60" y2="60"></line>',
      '<line x1="75" y1="45" x2="90" y2="60"></line>',
      '<circle cx="75" cy="20" r="10"></circle>',
      "<text>読む人</text>",
      "</g>",
      "</svg>",
    ].join(""),
  );
  const svg = host.querySelector("svg") as SVGSVGElement;
  // 実行
  replaceMermaidActors(svg);
  // 検証
  const group = svg.querySelector("g.actor-man");
  const children = [...(group?.children ?? [])];
  expect(children.map((child) => child.tagName.toLowerCase())).toEqual([
    "svg",
    "text",
  ]);
  const icon = children[0];
  expect(icon?.classList.contains("mdmark-mermaid-actor")).toBe(true);
  expect(icon?.getAttribute("width")).toBe("30");
  expect(icon?.getAttribute("height")).toBe("30");
  expect(icon?.getAttribute("x")).toBe("60");
  expect(icon?.getAttribute("y")).toBe("10");
  expect(children[1]?.textContent).toBe("読む人");
});
