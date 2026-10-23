import { escapeHtml } from "../escape.ts";

/** テストで差し替えないときの jsDelivr の配信元（末尾の `/` を持たない） */
export const DIST_BASE = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark";

/** `{配信元}@{バージョン}/dist/{ファイル}` を返す */
export function distUrl(options: {
  /** 配信元（`DIST_BASE` か `MDMARK_VSCODE_DIST_BASE`） */
  base: string;
  /** mdmark のバージョン */
  version: string;
  /** 配布物のファイル */
  file: "index.js" | "index.css";
}): string {
  const { base, version, file } = options;
  return `${base}@${version}/dist/${file}`;
}

/** インターフェース定義の制約「CSP」のとおりの `Content-Security-Policy` の値を組む */
export function buildCsp(options: {
  /** この HTML の nonce */
  nonce: string;
  /** 配布物の origin */
  distOrigin: string;
  /** `libraries` の origin */
  libraryOrigins: string[];
  /** `Webview.cspSource` */
  cspSource: string;
}): string {
  const { nonce, distOrigin, libraryOrigins, cspSource } = options;
  return [
    "default-src 'none'",
    `script-src ${[`'nonce-${nonce}'`, distOrigin, ...libraryOrigins, cspSource].join(" ")}`,
    `style-src ${distOrigin} ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} https: data:`,
    `font-src ${distOrigin} ${cspSource}`,
    `connect-src ${distOrigin}`,
  ].join("; ");
}

/** Webview の HTML を組む。CSP・`<base>`・配布物の CSS・パネルの CSS・描く先を包む要素・nonce 付きのパネルのスクリプトを持つ。属性に入れる値はエスケープする。バージョンを決められないときは配布物の `link` と `data-dist-js` を持たず `data-status="versionUndecidable"` を持つ */
export function buildPreviewHtml(options: {
  /** 全ての `script` に付ける nonce */
  nonce: string;
  /** `Content-Security-Policy` の値 */
  csp: string;
  /** Markdown のフォルダの `asWebviewUri` に `/` を付けたもの */
  baseHref: string;
  /** 配布物の `index.js` の URL */
  distJs?: string;
  /** 配布物の `index.css` の URL */
  distCss?: string;
  /** 読むバージョン */
  version?: string;
  /** `media/preview.js` の `asWebviewUri` */
  scriptUri: string;
  /** `media/preview.css` の `asWebviewUri` */
  styleUri: string;
  /** `mdmark.configPath` の記載したままの値 */
  configPath: string;
  /** テストのときだけ `data-test` を持つ */
  test: boolean;
}): string {
  const { nonce, distJs, distCss, version } = options;
  const attributes = [
    'id="mdmark-preview"',
    distJs === undefined ? "" : `data-dist-js="${escapeHtml(distJs)}"`,
    version === undefined ? "" : `data-version="${escapeHtml(version)}"`,
    distJs === undefined ? 'data-status="versionUndecidable"' : "",
    `data-config-path="${escapeHtml(options.configPath)}"`,
    options.test ? "data-test" : "",
  ].filter((attribute) => attribute !== "");
  const distLink =
    distCss === undefined
      ? ""
      : `<link rel="stylesheet" href="${escapeHtml(distCss)}">\n`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(options.csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="${escapeHtml(options.baseHref)}">
${distLink}<link rel="stylesheet" href="${escapeHtml(options.styleUri)}">
<title>mdmark プレビュー</title>
</head>
<body>
<div ${attributes.join(" ")}></div>
<script type="module" nonce="${escapeHtml(nonce)}" src="${escapeHtml(options.scriptUri)}"></script>
</body>
</html>
`;
}

/** `crypto.getRandomValues` の 16 バイトを base64url にした文字列を返す（HTML を入れるたびに作り直す） */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Buffer.from(bytes).toString("base64url");
}
