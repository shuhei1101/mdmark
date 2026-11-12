import { afterEach, expect, test, vi } from "vitest";

/** まとめた HTML の起動の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBundle = () => import("../../../../src/viewer/bundle.ts");

/** 画面の骨組みを作る処理を読み込む（骨組みは書き出す HTML の `body` を使用する） */
const loadHtml = () => import("../../../../src/cli/html.ts");

// 文書 a.md（entry）と b.md をまとめた中身
const PAYLOAD = {
  kind: "bundle" as const,
  config: {},
  docs: [
    { path: "a.md", title: "A", markdown: "# 文書A\n" },
    { path: "b.md", title: "B", markdown: "# 文書B\n" },
  ],
  entry: "a.md",
};

const ORIGINAL_URL = `${location.pathname}${location.search}`;

// 段落 200 個の中ほどに b.md へのリンクを持つ a.md（entry）と、目次と見出しを持つ b.md をまとめた中身
const LONG_PAYLOAD = {
  ...PAYLOAD,
  docs: [
    {
      path: "a.md",
      title: "A",
      markdown: [
        "# 文書A",
        "",
        ...Array.from({ length: 200 }, (_, index) =>
          index === 99 ? "[B へ](b.md)\n" : `段落 ${index + 1}\n`,
        ),
      ].join("\n"),
    },
    {
      path: "b.md",
      title: "B",
      markdown:
        "# 文書B\n\n<!-- toc -->\n\n## 一つ目\n\n本文\n\n## 二つ目\n\n本文\n",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  history.replaceState(null, "", ORIGINAL_URL);
  history.scrollRestoration = "auto";
  sessionStorage.clear();
  window.scrollTo(0, 0);
});

/** 次の `hashchange` を待つ */
function nextHashchange(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener("hashchange", () => resolve(), { once: true });
  });
}

/** 描いた文書の中の、指した文書へのリンクを返す */
function linkTo(path: string): HTMLAnchorElement {
  const link = document.querySelector<HTMLAnchorElement>(
    `.mdmark-bundle-main a[href="#/${path}"]`,
  );
  if (link === null) {
    throw new Error(`${path} へのリンクが無い`);
  }
  return link;
}

/** a.md を 3000px スクロールして b.md へのリンクを押し、b.md へ移るまで待つ */
async function leaveLongDocument(): Promise<void> {
  window.scrollTo(0, 3000);
  const changed = nextHashchange();
  linkTo("b.md").click();
  await changed;
}

/** 書き出す HTML と同じ画面の骨組みをページに配置する */
async function placeSkeleton(): Promise<void> {
  const { assembleHtml } = await loadHtml();
  const html = assembleHtml({ payload: PAYLOAD, distCss: "", script: "" });
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const script of parsed.querySelectorAll("script")) {
    script.remove();
  }
  document.body.replaceChildren(...parsed.body.childNodes);
}

// URL が指す文書を描き、一覧で開いている文書を示す（正常系）
test("test_start_bundle", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  history.replaceState(null, "", "#/b.md");
  // 実行
  startBundle(document, PAYLOAD, {});
  // 検証
  expect(
    document.querySelector(".mdmark-bundle-main .mdmark h1")?.textContent,
  ).toContain("文書B");
  const side = document.querySelector(".mdmark-bundle-side");
  const current = [...(side?.querySelectorAll("a") ?? [])].filter(
    (link) => link.getAttribute("aria-current") === "page",
  );
  expect(current.map((link) => link.getAttribute("data-doc-path"))).toEqual([
    "b.md",
  ]);
});

// 1 枚に無い文書を指すと entry を描き URL を合わせる（正常系）
test("test_start_bundle_when_missing_document", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  history.replaceState(null, "", "#/下書き/メモ.md");
  // 実行
  startBundle(document, PAYLOAD, {});
  // 検証
  expect(
    document.querySelector(".mdmark-bundle-main .mdmark h1")?.textContent,
  ).toContain("文書A");
  expect(location.hash).toBe("#/a.md");
});

// 右側の目次の項目を押すと、閉じたセクションを開いて見出しへ移る（正常系）
test("test_start_bundle_when_side_toc_link_into_closed_section", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  const payload = {
    ...PAYLOAD,
    docs: [
      { path: "a.md", title: "A", markdown: "# 文書A\n" },
      {
        path: "b.md",
        title: "B",
        markdown:
          '## 導入\n\n<!-- section: {"open": false} -->\n\n### 注意\n\n本文\n',
      },
    ],
  };
  history.replaceState(null, "", "#/b.md");
  startBundle(document, payload, {});
  const body = document.querySelector<HTMLElement>('[id="section-導入"]');
  const link = document.querySelector<HTMLAnchorElement>(
    '.mdmark-side-toc a[data-heading-id="注意"]',
  );
  if (body === null || link === null) {
    throw new Error("セクションの中身か右側の目次の項目が無い");
  }
  expect(body.hasAttribute("hidden")).toBe(true);
  // 実行
  link.click();
  // 検証
  expect(body.hasAttribute("hidden")).toBe(false);
  expect(decodeURIComponent(location.hash)).toBe("#/b.md#注意");
});

// 戻るで、離れたときの位置へ戻り、リンクで移ったときは頭から描く（正常系）
test("test_start_bundle_when_back_restores_view_state", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  sessionStorage.clear();
  history.replaceState(null, "", "#/a.md");
  startBundle(document, LONG_PAYLOAD, {});
  await leaveLongDocument();
  const scrollAfterLink = window.scrollY;
  // 実行
  const back = nextHashchange();
  history.back();
  await back;
  // 検証
  expect(scrollAfterLink).toBe(0);
  expect(
    document.querySelector(".mdmark-bundle-main .mdmark h1")?.textContent,
  ).toContain("文書A");
  expect(Math.abs(window.scrollY - 3000)).toBeLessThanOrEqual(1);
  expect(history.scrollRestoration).toBe("manual");
});

// 戻るで開閉とタブを戻した後、フォーカスを h1 へ移す（正常系）
test("test_start_bundle_when_back_focuses_title", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  const payload = {
    ...PAYLOAD,
    docs: [
      {
        path: "a.md",
        title: "A",
        markdown:
          "# 文書A\n\n<!-- tabs -->\n\n## 一つ目\n\n本文\n\n## 二つ目\n\n[B へ](b.md)\n\n<!-- /tabs -->\n",
      },
      { path: "b.md", title: "B", markdown: "# 文書B\n" },
    ],
  };
  history.replaceState(null, "", "#/a.md");
  startBundle(document, payload, {});
  const tab = document.querySelector<HTMLButtonElement>(
    ".mdmark-bundle-main .mdmark-tab:nth-of-type(2)",
  );
  if (tab === null) {
    throw new Error("2 つ目のタブが無い");
  }
  tab.click();
  const changed = nextHashchange();
  linkTo("b.md").click();
  await changed;
  // 実行
  const back = nextHashchange();
  history.back();
  await back;
  // 検証
  const restored = document.querySelector(
    ".mdmark-bundle-main .mdmark-tab:nth-of-type(2)",
  );
  expect(restored?.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(
    document.querySelector(".mdmark-bundle-main h1"),
  );
});

// 見出しへ移るリンクで URL を置き換えても、履歴の項目の ID を引き継ぐ（正常系）
test("test_start_bundle_when_heading_link_keeps_entry_id", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  history.replaceState(null, "", "#/b.md");
  startBundle(document, LONG_PAYLOAD, {});
  const before = history.state?.mdmarkEntry;
  const link = document.querySelector<HTMLAnchorElement>(
    '.mdmark-bundle-main .mdmark-toc a[href^="#/b.md#"]',
  );
  if (link === null) {
    throw new Error("目次の見出しのリンクが無い");
  }
  // 実行
  link.click();
  // 検証
  expect(before).toEqual(expect.any(String));
  expect(history.state?.mdmarkEntry).toBe(before);
});

// sessionStorage が使えないと、戻るで文書の頭から描き例外を出さない（異常系）
test("test_start_bundle_when_session_storage_unavailable", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("使えない", "SecurityError");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  history.replaceState(null, "", "#/a.md");
  startBundle(document, LONG_PAYLOAD, {});
  await leaveLongDocument();
  // 実行
  const back = nextHashchange();
  history.back();
  await back;
  // 検証
  expect(
    document.querySelector(".mdmark-bundle-main .mdmark h1")?.textContent,
  ).toContain("文書A");
  expect(window.scrollY).toBe(0);
  expect(warn).toHaveBeenCalled();
});

// キーを data: URL に替え、フラグメントを残す（正常系）
test("test_restore_assets", async () => {
  // 準備
  const { restoreAssets } = await loadBundle();
  const markdown = "![図](mdmark-asset:a1#only-dark)\n";
  // 実行
  const restored = restoreAssets(markdown, {
    a1: "data:image/png;base64,AA==",
  });
  // 検証
  expect(restored).toBe("![図](data:image/png;base64,AA==#only-dark)\n");
});

// 知らないキーは替えない（正常系）
test("test_restore_assets_when_unknown", async () => {
  // 準備
  const { restoreAssets } = await loadBundle();
  const markdown = "![図](mdmark-asset:zz)\n";
  // 実行
  const restored = restoreAssets(markdown, {});
  // 検証
  expect(restored).toBe(markdown);
});

// 文書の # の無い項目へ戻る（正常系）
test("test_start_bundle_when_back_to_entry_without_hash", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  history.replaceState(null, "", location.pathname + location.search);
  startBundle(document, PAYLOAD, {});
  const link = [
    ...document.querySelectorAll<HTMLAnchorElement>(".mdmark-bundle-side a"),
  ].find((item) => item.getAttribute("data-doc-path") === "b.md");
  link?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  // 実行
  const back = new Promise((resolve) =>
    window.addEventListener("popstate", resolve, { once: true }),
  );
  history.back();
  await back;
  // 検証
  expect(
    document.querySelector(".mdmark-bundle-main .mdmark h1")?.textContent,
  ).toContain("文書A");
});

// 文書を切り替えると map のクエリ文字列を消す（正常系）
test("test_start_bundle_when_switch_clears_map_query", async () => {
  // 準備
  const { startBundle } = await loadBundle();
  await placeSkeleton();
  history.replaceState(null, "", "?map-1=place&x=1#/a.md");
  startBundle(document, PAYLOAD, {});
  const link = [
    ...document.querySelectorAll<HTMLAnchorElement>(".mdmark-bundle-side a"),
  ].find((item) => item.getAttribute("data-doc-path") === "b.md");
  // 実行
  link?.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  // 検証
  expect(location.search).toBe("?x=1");
  expect(
    document.querySelector(".mdmark-bundle-main .mdmark h1")?.textContent,
  ).toContain("文書B");
  history.back();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(location.search).toBe("?map-1=place&x=1");
});
