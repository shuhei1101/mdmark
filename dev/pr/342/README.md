# VS Code の webview の画面を React（Vite + shadcn/ui）へ移す

## 概要

VS Code 拡張機能のプレビューの Webview の画面を React（Vite + shadcn/ui + Tailwind）へ移し、今の機能を全て再現する。
viewer・書き出す HTML の部品・CDN で配る `dist/index.js` と公開の `mount` 系の関数は変えず、モックを Storybook（react-vite）+ MSW へ移し、lint・検査・Git フックを導入する。

## 背景

[Issue #173](https://github.com/shuhei1101/mdmark/issues/173) の要望。
knowledge の規約をバニラ TS から React 前提に改めたのに合わせて（[shuhei1101/knowledge#79](https://github.com/shuhei1101/knowledge/issues/79)・[shuhei1101/knowledge#80](https://github.com/shuhei1101/knowledge/issues/80)）、バニラ TS で実装した Webview の画面（`vscode/src/webview/`）を React へ移す。
モックの手順は [shuhei1101/ai-monitor#3065](https://github.com/shuhei1101/ai-monitor/issues/3065) で Storybook + MSW に切り替わった。

viewer（`src/viewer/`）は `mdmark build` が書き出す全ての HTML に埋め込まれるため、React にすると書き出す HTML ごとに React のランタイムが入る。
表など書き出す HTML の部品も同じ理由で今のまま残す（[確認事項の回答](https://github.com/shuhei1101/mdmark/issues/173#issuecomment-6454379370)）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | Webview の React 化・ビルド・モックの計画書 |
| [ライブラリ本体](./ライブラリ本体.md) | Storybook・ESLint・Git フックの計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [ ] PoC 検証（React + Vite + Tailwind の Webview が今の CSP の下で動き、jsDelivr の配布物を `import()` で描けるか。`@storybook/react-vite` で server 形式の部品の HTML を描けるか。拡張機能ホストの Webview で axe を実行できるか）
- [x] ~~複合ユースケース設計~~（影響なし: 業務の流れは変わらない）
- [x] ~~デザインスタイル選定~~（デザイン方針があり、Webview の部品は shadcn/ui を VS Code の配色のトークンに割り当てるため、見た目の方向は変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] ~~単一ユースケース設計~~（影響なし: 利用者の操作は変わらない）
- [ ] モック作成（状態の表示・設定ファイルを読めない帯・再生できない動画・音声の通知を Storybook のストーリーで作る）
- [x] ~~インターフェース定義設計~~（影響なし: コマンド・Webview とのメッセージの入出力は変わらない）
- [ ] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [x] ~~E2E テスト作成~~（シナリオは変わらず、既存の VS Code の E2E を実行のみ）
