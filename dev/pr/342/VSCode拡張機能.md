# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | Webview のスクリプト（`PreviewView` クラス・`startPreview`・スクロール・アセット）とメッセージの型 | React のコンポーネントと hook の構成に書き換える |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/ビルドと配布.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%93%E3%83%AB%E3%83%89%E3%81%A8%E9%85%8D%E5%B8%83.ts.yaml) | `buildExtension` が esbuild で `media/preview.js`・`media/preview.css` を出力する | Webview のビルドを Vite へ替える |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの HTML と CSP（`vscode/src/preview/html.ts`） | CSP と参照する JS・CSS の名前が Vite の出力に合うかを確認する |
| ドキュメント | [dev/設計書/画面設計/VSCodeのプレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの要素（描く先を包む要素・描いた文書・読み込み中の表示・描けない理由・設定ファイルを読めない帯・再生できない動画・音声の通知） | `screen` と `mock` を React の画面とストーリーに向け直す |
| ドキュメント | [dev/設計書/部品設計/プレビューの状態の表示.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E9%83%A8%E5%93%81%E8%A8%AD%E8%A8%88/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E7%8A%B6%E6%85%8B%E3%81%AE%E8%A1%A8%E7%A4%BA.ts.yaml) | 読み込み中と描けない理由と「リロード」 | React のコンポーネントの props とストーリーに書き換える |
| ドキュメント | [dev/設計書/部品設計/設定ファイルを読めない帯.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E9%83%A8%E5%93%81%E8%A8%AD%E8%A8%88/%E8%A8%AD%E5%AE%9A%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%82%92%E8%AA%AD%E3%82%81%E3%81%AA%E3%81%84%E5%B8%AF.ts.yaml) | 設定ファイルを読めない帯と「設定ファイルを開く」 | 同上 |
| ドキュメント | [dev/設計書/部品設計/再生できない動画・音声の知らせ.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E9%83%A8%E5%93%81%E8%A8%AD%E8%A8%88/%E5%86%8D%E7%94%9F%E3%81%A7%E3%81%8D%E3%81%AA%E3%81%84%E5%8B%95%E7%94%BB%E3%83%BB%E9%9F%B3%E5%A3%B0%E3%81%AE%E7%9F%A5%E3%82%89%E3%81%9B.ts.yaml) | 再生できない動画・音声の要素を替える枠と「既定のアプリで開く」 | 同上 |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/preview.ts) | パネルの中の入口（配布物の参照・`mount`・`update`・リンク・スクロール・`inspect`・`setState`） | React の入口とコンポーネント・hook に分ける |
| 実装 | [vscode/src/webview/scroll.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/scroll.ts) | 元の行番号とスクロールの位置の内分 | DOM に依存しない計算はそのまま移す |
| 実装 | [vscode/src/webview/assets.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/assets.ts) | 相対パスのアセットの差し替えと再生できない要素の通知 | 同上 |
| 実装 | [vscode/src/webview/parts/preview-status.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/parts/preview-status.ts)・[config-band.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/parts/config-band.ts)・[media-error.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/parts/media-error.ts) | 状態の表示・帯・通知の HTML 文字列を返す関数と `*.stories.yaml` | `.tsx` のコンポーネントと `.stories.tsx` に置き換える |
| 実装 | [vscode/src/webview/preview.css](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/preview.css) | パネルの状態の表示と帯の CSS | Tailwind のトークンとユーティリティに置き換える |
| 実装 | [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) | パネルの HTML と `buildCsp` | Vite の出力の名前と CSP の `style-src`（Tailwind の CSS）に合わせる |
| 実装 | [vscode/scripts/build.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/scripts/build.ts) | esbuild で拡張機能と Webview をまとめる | 拡張機能（`dist/extension.cjs`）は esbuild のまま、Webview を Vite で出力する |
| テスト | [tests/unit/vscode/src/webview/preview.browser.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/webview/preview.browser.test.ts) ほか `tests/unit/vscode/src/webview/` | Webview の単体テスト（Vitest のブラウザ） | React のコンポーネントと hook の単体テストに書き換える |
| テスト | `vscode/tests/integration/` | 拡張機能ホストで実行する結合テスト（`inspect` で Webview の DOM を確認する） | Webview の DOM の class・属性を変えた分だけ期待値を修正する |
| テスト | `tests/e2e/単一ユースケース/` の VS Code のシナリオ | VS Code の E2E | 実行のみ |
| モック | [dev/mock/pages/vscode-preview/](https://github.com/shuhei1101/mdmark/blob/develop/dev/mock/pages/vscode-preview/) | パネルのモック HTML（#69・#181・#196） | Storybook のストーリーへ移す |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 構成 | knowledge の規約『フォルダ構成』『命名』に沿って、Webview を入口・画面・部品・hook・`lib` に分ける。1 画面のためルーターと `routes/` は配置しない | `未確定`（置き場所） |
| ビルド | Webview を Vite（`@vitejs/plugin-react` + React Compiler）で `media/preview.js`・`media/preview.css` に出力する。`tsc` は型検査だけ | 拡張機能本体は esbuild のまま |
| 配布物の参照 | jsDelivr の mdmark の配布物を実行時の `import()` で参照し、まとめない | 今と同じ |
| 描画 | mdmark の `mount` の描く先の要素は React の外の DOM として持ち、`mount`・`update`・`destroy` を effect の中で呼ぶ | 規約『effect』の外部のシステムとの同期に当たる |
| 状態の表示・帯・通知 | shadcn/ui（`Alert`・`Button` など）で作り直し、文言とメッセージの送信は今と同じにする | 見た目は作り直してよい |
| スタイル | Tailwind v4 のトークンを `:root` の 3 ティアで持ち、`@theme inline` で割り当て、標準のパレットを削除する。VS Code の色（`--vscode-*`）を意味のトークンに割り当てる | 任意値は lint で禁止する |
| 配色の固定 | `mdmark.preview.theme` の class（`mdmark-theme-light`・`mdmark-theme-dark`）を今と同じ要素に付ける | 描いた文書の配色は変えない |
| CSP | `script-src` と `style-src` は今の nonce・Webview のリソースの範囲から広げない。Vite の出力に inline のスクリプト・スタイルを出さない | PoC 検証で確認する |
| メッセージ | `HostMessage`・`WebviewMessage`・`InspectedElement` は変えない | `vscode/src/messages.ts`。結合テストの axe のため、テストのときだけの `axe`・`axed` を加える |
| モック | Webview の部品と画面の状態を Storybook（`@storybook/react-vite`）のストーリーにし、拡張機能から受けるメッセージはデコレーターで、jsDelivr の配布物とタグ一覧は MSW で差し込む | `dev/mock/pages/vscode-preview/` の扱いはモック作成で決める |
| lint | ESLint の Flat Config で、Webview の `.ts`・`.tsx` に typescript-eslint・react-hooks・jsx-a11y・boundaries・better-tailwindcss・複雑さの規則を error で適用する | Biome との受け持ちはモジュール構成設計で決める |
| アクセシビリティ | Storybook の `addon-a11y` と、結合テストで Playwright の axe を実行し、違反を 0 件にする | VS Code の拡張機能ホストの中で axe を実行できるかは PoC 検証で確認する |
| 既存機能への影響 | 単体・結合・E2E のテストの期待値は、DOM の class・属性を変えた分だけ修正し、振る舞いのケースは減らさない | - |

<!-- /table -->

`未確定`: Webview の React のコードの置き場所（決める段: モジュール構成設計）

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| A | `vscode/src/webview/` の下に、規約『フォルダ構成』の `src/` の中の構成（`app/`・`features/`・`shared/`）を配置する。設定は `vscode/` の `package.json` と `vite.config.ts` に配置する | 拡張機能が 1 つのフォルダで完結し、`.vsix` に入れるものの範囲が今と同じ | 規約の「`package.json` と設定はリポジトリの直下」から外れる |
| B | リポジトリの直下の `package.json` と `vite.config.ts` に React の設定を配置し、Vite の `root` を `vscode/src/webview/` にする | 規約のとおり | 拡張機能の依存が直下と `vscode/` の 2 つの `package.json` に分かれる |

推奨: A

規約の直下に配置する決まりはフロントエンドとバックエンドが 1 つのリポジトリに入る構成を前提にしており、mdmark の拡張機能は `vscode/` に独立した `package.json` と配布物を持つ。

決定: A（モジュール構成設計で確定。Storybook は直下の設定のまま、`resolve.alias` の `@` を `vscode/src/webview` に向ける）

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 部品設計・画面設計 | `502d1f0..62d26c4` | - |
| 部品設計 | `3bf5686..bf28b6b` | レビューの任意の指摘の修正 |
| モジュール構成設計 | `bf28b6b..4a6ecbf` | 部品設計の状態 `Unexpected` の追加と、インターフェース定義のテストのときのメッセージの追加を含む |
| モジュール構成設計 | `4a6ecbf..ad3ed91` | レビューの任意の指摘の修正 |
| モジュール構成設計 | `48aac41..7ec8e8d` | 単体テスト作成で見つけた構造問題の修正（`DocumentView` をクラスでなく `createDocumentView` が返す型にする。単体テストの HEAD を MSW でなく `window.fetch` の代役にする） |
| モジュール構成設計 | `d9509a0..b15cf5c` | レビューの指摘の修正（単体テストもストーリーと同じ MSW のハンドラに戻し、`unit-browser` の `publicDir` で Service Worker を配信する） |
| モジュール構成設計 | `24b4ad7f..d8cddd82` | 実装で見つけた構造問題の修正（ESLint を TypeScript 6.0 と組んだ `tools/eslint/` の package に分ける。`boundaries/dependencies` と Tailwind の規則の水準。`PreviewState` を `shared/adapters/vscode-api.ts` へ移す） |
| モジュール構成設計 | `a54ede74..a572536b` | 実装で見つけた構造問題の修正（pre-push の単体テストの前に、worktree のフックに Git が渡す `GIT_DIR` などを外す） |
| モジュール構成設計 | `629f1a9a..75b7939b` | レビューの指摘の修正（`GIT_DIR` などはフックでなく `vitest.config.ts` の `clearGitLocalEnv` で、`git rev-parse --local-env-vars` の一覧で外す） |

## PoC 結果

<!-- table: data -->

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| 1. Vite 8 + `@vitejs/plugin-react` 6 + React Compiler（`@rolldown/plugin-babel` + `reactCompilerPreset`）+ Tailwind v4 の Webview を、今の `buildCsp` の CSP で描く | VS Code 1.141.0・stable（1.145.1）で CSP 違反 0 件、代役の配布物の `mount` で描け `rendered` が届く | ✅ 両方で違反 0 件 | [#343](https://github.com/shuhei1101/mdmark/pull/343) | `securitypolicyviolation` を Webview で数えた。`buildCsp` は変えていない |
| 1. 同上 | 出力が `media/preview.js`（ES モジュール 1 ファイル）と `media/preview.css` の 2 つで、inline の `<script>` を出さない | ✅ 2 ファイル（345 KB・13 KB） | 同上 | `build.lib` の `formats: ["es"]`・`codeSplitting: false` |
| 1. 同上 | `logger` に `CompileSuccess`、`preview.js` に `react.memo_cache_sentinel`、`tsc --noEmit` が通る | ✅ 全コンポーネントで `CompileSuccess`・3 件・通る | 同上 | コンポーネントの中に `import()` を書くと `CompileError`（`Handle ImportExpression expressions`）になる |
| 1b. Preflight を参照せず `tailwindcss/theme`・`tailwindcss/utilities` だけを層に入れる | 見出し・段落・リスト・画像の `getComputedStyle` が `develop` の Webview と一致する | ✅ 両方のバージョンで 10 要素 × 8 プロパティが一致 | 同上 | `font-size`・`list-style-type`・`margin`・`padding-left`・`display`・`border-top-width`・`box-sizing` |
| 1b. 同上 | 描けない理由の部品（`Alert` + `Button`）が崩れずに出る | ✅ | 同上 | [1280px](https://github.com/shuhei1101/mdmark/blob/9ffbb715d8a9ac61e3400a0947e7ebafc10cb77c/poc-results/status-react-1280.png)・[390px](https://github.com/shuhei1101/mdmark/blob/9ffbb715d8a9ac61e3400a0947e7ebafc10cb77c/poc-results/status-react-390.png)（VS Code の Dark Modern の色を `--vscode-*` に与えた） |
| 3. 結合テストのビルドだけ `media/test/axe.js` を複写し、`data-test` のときだけ `import()` する | 結合テストから `axe.run()` の違反の一覧を受け取れる | ✅ 両方のバージョンで受け取れた | 同上 | 描いた文書で `label-content-name-mismatch`、描けない理由で `color-contrast` を検出した |
| 3. 同上 | 本番の `preview.js` に axe が入らない | ✅ `axe-core` の文字列 0 件 | 同上 | `--tests` を付けないビルドは `media/test/` を作らない構成にする |

<!-- /table -->

結論: 成立。React の Webview は今の CSP・配布物の参照のまま動き、Preflight を参照しない構成なら描いた文書の見た目は変わらない。

実装へ持ち越す所見:

| 所見 | 扱い |
| --- | --- |
| React Compiler は `import()` を中に持つコンポーネントを変換しない | 配布物の `import()` はコンポーネントの外の関数に配置する（モジュール構成設計） |
| Preflight を参照しないと、パネルの部品の書体がブラウザの既定（明朝）になる | パネルの部品の下地に `font-family: var(--vscode-font-family)` を配置する |
| Webview の `--vscode-*` を意味のトークンに割り当てる `:root` の変数は、`--vscode-*` と同じ要素で計算される | トークンの 3 ティアは `:root` に配置し、Storybook は `--vscode-*` を `:root` に与えるデコレーターで描く |
| axe の `color-contrast`（描けない理由の文）と `label-content-name-mismatch`（描いた文書） | 実装で原因の要素を特定して修正する。描いた文書の側なら mdmark 本体の問題として切り出す |
| `media/test/axe.js` が `.gitignore` に無い | 実装で `vscode/media/` を丸ごと管理の外にする |

最小再現コードの要点（[#343 の diff](https://github.com/shuhei1101/mdmark/pull/343/files)）:

```tsx
// vscode/src/webview/react/main.tsx（要点）
const loadMdmark = (url: string): Promise<Mdmark> =>
  import(/* @vite-ignore */ url); // コンポーネントの外に配置する

useEffect(() => {
  if (mdmark === undefined) return;
  const onMessage = (event: MessageEvent<HostMessage>) => {
    const message = event.data;
    const element = documentRef.current; // React の外の DOM に mount させる
    if (message.type === "render" && element !== null) {
      handleRef.current ??= mdmark.mount(element, { markdown: message.markdown, config: message.config });
      setStatus(undefined);
      api.postMessage({ type: "rendered" });
    }
  };
  window.addEventListener("message", onMessage);
  api.postMessage({ type: "ready" }); // 受ける用意ができてから ready を送信する
  return () => { window.removeEventListener("message", onMessage); handleRef.current?.destroy(); };
}, [mdmark]);
```

```css
/* vscode/src/webview/react/preview.css（要点） */
@layer theme, panel-base, utilities;
@import "tailwindcss/theme.css" layer(theme) theme(static);
@import "tailwindcss/utilities.css" layer(utilities);
@theme inline { --color-*: initial; --color-card: var(--mdmark-panel-card); /* … */ }
```

diff の見どころ: `vscode/vite.config.ts`（ライブラリの出力と React Compiler の logger）、`vscode/tests/integration/poc-react.test.ts`（計算済みのスタイル・CSP・axe の記録）、`poc-results/`（`develop` と React の結果の JSON とログ）。

## テスト結果

ドキュメント修正（アーキテクチャ図・CLAUDE.md）は文書だけの変更で、関係する単体・結合テストは無い。
