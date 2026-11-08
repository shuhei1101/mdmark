import { expect, test } from "vitest";

/** Webview の HTML の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHtml = () => import("../../../../../vscode/src/preview/html.ts");

/** 属性の値の HTML の文字参照を戻す */
function unescapeAttribute(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** 開始タグの文字列のうち、`selector` の属性を持つものを返却する */
function findTag(html: string, pattern: RegExp): string | undefined {
  return html.match(pattern)?.[0];
}

/** 全ての `script` の開始タグを返却する */
function scriptTags(html: string): string[] {
  return html.match(/<script\b[^>]*>/g) ?? [];
}

const BASE_OPTIONS = {
  nonce: "abc",
  csp: "default-src 'none'",
  baseHref: "vscode-webview://x/docs/",
  scriptUri: "vscode-webview://x/media/preview.js",
  styleUri: "vscode-webview://x/media/preview.css",
  configPath: "mdmark.config.yaml",
  extensions: [] as string[],
};

// バージョン付きの URL を組む（正常系）
test("test_dist_url", async () => {
  // 準備
  const { distUrl, DIST_BASE } = await loadHtml();
  // 実行
  const url = distUrl({
    base: DIST_BASE,
    version: "v0.10.0",
    file: "index.js",
  });
  // 検証
  expect(url).toBe(
    "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js",
  );
});

// スクリプトは nonce と配信元だけ、スタイルに unsafe-inline を追加する（正常系）
test("test_build_csp", async () => {
  // 準備
  const { buildCsp } = await loadHtml();
  // 実行
  const csp = buildCsp({
    nonce: "abc",
    distOrigin: "https://cdn.jsdelivr.net",
    libraryOrigins: ["https://cdn.example.com"],
    cspSource: "https://*.vscode-cdn.net",
  });
  // 検証
  expect(csp).toBe(
    [
      "default-src 'none'",
      "script-src 'nonce-abc' https://cdn.jsdelivr.net https://cdn.example.com https://*.vscode-cdn.net",
      "style-src https://cdn.jsdelivr.net https://*.vscode-cdn.net 'unsafe-inline'",
      "img-src https://*.vscode-cdn.net https: data:",
      "media-src https://*.vscode-cdn.net https: data:",
      "font-src https://cdn.jsdelivr.net https://*.vscode-cdn.net",
      "connect-src https://cdn.jsdelivr.net",
    ].join("; "),
  );
});

// CSP・base・配布物・スクリプトの nonce を持つ（正常系）
test("test_build_preview_html", async () => {
  // 準備
  const { buildPreviewHtml } = await loadHtml();
  const distJs = "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.js";
  const distCss = "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.css";
  // 実行
  const html = buildPreviewHtml({
    ...BASE_OPTIONS,
    distJs,
    distCss,
    version: "v0.10.0",
    test: false,
  });
  // 検証
  const csp = findTag(
    html,
    /<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/?>/,
  );
  expect(unescapeAttribute(csp ?? "")).toContain(
    `content="${BASE_OPTIONS.csp}"`,
  );
  expect(html).toMatch(/<base href="vscode-webview:\/\/x\/docs\/"\s*\/?>/);
  expect(html).toMatch(
    new RegExp(`<link rel="stylesheet" href="${distCss}"\\s*/?>`),
  );
  const boot = findTag(html, /<[a-z]+\b[^>]*id="mdmark-preview"[^>]*>/);
  expect(boot).toContain(`data-dist-js="${distJs}"`);
  expect(boot).toContain('data-version="v0.10.0"');
  expect(boot).not.toContain("data-test");
  const tags = scriptTags(html);
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) {
    expect(tag).toContain('nonce="abc"');
  }
});

// バージョンを決められないときは配布物を読み込まない（正常系）
test("test_build_preview_html_when_undecidable", async () => {
  // 準備
  const { buildPreviewHtml } = await loadHtml();
  // 実行
  const html = buildPreviewHtml({ ...BASE_OPTIONS, test: true });
  // 検証
  const links = [...html.matchAll(/<link\b[^>]*href="([^"]*)"/g)].map(
    (match) => match[1],
  );
  expect(links).toEqual([BASE_OPTIONS.styleUri]);
  const boot = findTag(html, /<[a-z]+\b[^>]*id="mdmark-preview"[^>]*>/);
  expect(boot).toContain('data-status="versionUndecidable"');
  expect(boot).toContain("data-test");
  expect(boot).not.toContain("data-dist-js");
});

// 属性の値をエスケープする（正常系）
test("test_build_preview_html_when_special_chars", async () => {
  // 準備
  const { buildPreviewHtml } = await loadHtml();
  // 実行
  const html = buildPreviewHtml({
    ...BASE_OPTIONS,
    configPath: 'a"><script>x</script>.yaml',
    test: false,
  });
  // 検証
  expect(html).toContain(
    'data-config-path="a&quot;&gt;&lt;script&gt;x&lt;/script&gt;.yaml"',
  );
  for (const tag of scriptTags(html)) {
    expect(tag).toContain('nonce="abc"');
  }
});

// theme の CSS を配布物の CSS の後に読み込み、extensions を data-extensions に入れる（正常系）
test("test_build_preview_html_when_theme_and_extensions", async () => {
  // 準備
  const { buildPreviewHtml } = await loadHtml();
  const distCss = "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.css";
  // 実行
  const html = buildPreviewHtml({
    ...BASE_OPTIONS,
    distJs: "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.js",
    distCss,
    version: "v0.10.0",
    themeHref: "web:/w/t.css",
    extensions: ["web:/w/e.js"],
    test: false,
  });
  const plain = buildPreviewHtml({ ...BASE_OPTIONS, distCss, test: false });
  // 検証
  const theme = findTag(html, /<link\b[^>]*id="mdmark-theme"[^>]*>/);
  expect(theme).toContain('rel="stylesheet"');
  expect(theme).toContain('href="web:/w/t.css"');
  expect(html.indexOf(distCss)).toBeLessThan(html.indexOf('id="mdmark-theme"'));
  const boot = findTag(html, /<[a-z]+\b[^>]*id="mdmark-preview"[^>]*>/);
  expect(unescapeAttribute(boot ?? "")).toContain(
    'data-extensions="["web:/w/e.js"]"',
  );
  expect(plain).not.toContain("data-extensions");
  expect(plain).not.toContain('id="mdmark-theme"');
});

// 呼ぶたびに違う base64url の文字列を返却する（正常系）
test("test_create_nonce", async () => {
  // 準備
  const { createNonce } = await loadHtml();
  // 実行
  const first = createNonce();
  const second = createNonce();
  // 検証
  expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(second).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(first).not.toBe(second);
});
