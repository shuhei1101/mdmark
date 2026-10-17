import { afterEach, expect, test } from "vitest";

/** まとめた HTML の起動の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBundle = () => import("../../../../src/viewer/bundle.ts");

/** 画面の骨組みを作る処理を読み込む（骨組みは書き出す HTML の `body` を使う） */
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
  modules: {},
  extensions: [],
};

const ORIGINAL_URL = `${location.pathname}${location.search}`;

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", ORIGINAL_URL);
});

/** 書き出す HTML と同じ画面の骨組みをページに置く */
async function placeSkeleton(): Promise<void> {
  const { assembleHtml } = await loadHtml();
  const html = assembleHtml({ payload: PAYLOAD, distCss: "", viewer: "" });
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
