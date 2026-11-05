import { expect, test } from "vitest";

/** 範囲の css を根の要素の中に限る処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadScopeCss = () => import("../../../../src/render/scope-css.ts");

/** 範囲の通し番号から、範囲の根の要素のセレクタを作る */
const rootOf = (scope: number) => `.mdmark-html[data-html-scope="${scope}"]`;

/** 空白の並びを 1 つにそろえ、比べやすくする */
const squash = (css: string) => css.replace(/\s+/g, " ").trim();

// セレクタの前に根の要素を付け、`,` で分けたそれぞれに付ける（正常系）
test("test_scope_css", async () => {
  // 準備
  const { scopeCss } = await loadScopeCss();
  // 実行
  const scoped = scopeCss({ css: ".box, p > a { color: red }", scope: 0 });
  // 検証
  expect(squash(scoped)).toBe(
    `${rootOf(0)} .box, ${rootOf(0)} p > a { color: red }`,
  );
});

// `:scope`・`:root`・`body` を根の要素に置き換える（正常系）
test("test_scope_css_when_scope_selector", async () => {
  // 準備
  const { scopeCss } = await loadScopeCss();
  const css =
    ":scope.is-open .box { display: block } :root { --x: 1 } body p { margin: 0 }";
  // 実行
  const scoped = squash(scopeCss({ css, scope: 2 }));
  // 検証
  expect(scoped).toContain(`${rootOf(2)}.is-open .box { display: block }`);
  expect(scoped).toContain(`${rootOf(2)} { --x: 1 }`);
  expect(scoped).toContain(`${rootOf(2)} p { margin: 0 }`);
  expect(scoped).not.toContain(":scope");
  expect(scoped).not.toContain(":root");
  expect(scoped).not.toMatch(/(^|[\s,}])body\b/);
});

// `@media` の中は書き換え、`@keyframes` はそのまま、`@import`・`@scope`・`@starting-style` は落とす（正常系）
test("test_scope_css_when_at_rules", async () => {
  // 準備
  const { scopeCss } = await loadScopeCss();
  const css = [
    "@import url(x.css);",
    "@media (max-width: 600px) { .a { color: red } }",
    "@keyframes k { from { opacity: 0 } to { opacity: 1 } }",
    "@scope (html) { p { color: red } }",
    "@starting-style { .b { opacity: 0 } }",
  ].join(" ");
  // 実行
  const scoped = squash(scopeCss({ css, scope: 0 }));
  // 検証
  expect(scoped).not.toContain("@import");
  expect(scoped).not.toContain("@scope");
  expect(scoped).not.toContain("@starting-style");
  expect(scoped).toContain(
    `@media (max-width: 600px) { ${rootOf(0)} .a { color: red } }`,
  );
  expect(scoped).toContain(
    "@keyframes k { from { opacity: 0 } to { opacity: 1 } }",
  );
});

// 文字列・コメント・括弧の中の `,`・`{`・`}` で区切らない（正常系）
test("test_scope_css_when_strings_and_comments", async () => {
  // 準備
  const { scopeCss } = await loadScopeCss();
  const css =
    '/* a, b { } */ .a[data-x="1,2"], :is(.b, .c) { content: "}" }';
  // 実行
  const scoped = squash(scopeCss({ css, scope: 0 }));
  // 検証
  expect(scoped).toContain(
    `${rootOf(0)} .a[data-x="1,2"], ${rootOf(0)} :is(.b, .c) { content: "}" }`,
  );
});

// `</style` の並びで `style` 要素が閉じないように替える（正常系）
test("test_scope_css_when_style_end_tag", async () => {
  // 準備
  const { scopeCss } = await loadScopeCss();
  // 実行
  const scoped = scopeCss({ css: '.a { content: "</style>" }', scope: 0 });
  // 検証
  expect(scoped).not.toContain("</style");
  expect(scoped).toContain("<\\/style");
});
