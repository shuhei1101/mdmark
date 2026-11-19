# Claude Code の画面を mdmark の共通スタイルで描く mod のプラグイン mdmark-style を配置する

## 概要

Claude Code を使用する人が、Claude Code の画面（ターミナル版・デスクトップ・VS Code）でアシスタントの返答の表・見出し・注意書き・コードを mdmark の共通スタイルで読み、発言と返答に出た用語の意味をその場で確認できるようになる。

## 背景

[Claude Code の画面を mdmark の共通スタイルで描く mod のプラグイン mdmark-style を置く](https://github.com/shuhei1101/mdmark/issues/116) の要望。
今の mdmark のマーケットプレイス（[.claude-plugin/marketplace.json](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/.claude-plugin/marketplace.json)）はプラグイン `mdmark`（MCP とフック）だけを持ち、Claude Code の画面の描画には手を入れていない。
mdmark の共通スタイル（色・表・注意書きの種類）は Web の描画の CSS（[src/index.css](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/src/index.css)）にだけあり、Claude Code の mod（TypeScript）からは参照できない。
Claude Code の画面は返答の HTML コメントを隠さず文字で出すため、返答に記載した mdmark のマーカーはそのまま画面に出る。
話し合いで、mod は単独のプラグイン mdmark-style にし、YAML の文書・MCP に依存せず、用語は `mdmark.config.yaml` の索引・aliases・用語集の表から取る（[用語の取り元の追記](https://github.com/shuhei1101/mdmark/issues/116#issuecomment-6386949363)）と決めた。
依存先の [エイリアスを YAML（aliases[]）からも登録できるようにする](https://github.com/shuhei1101/mdmark/issues/125) と [設定ファイルを重ねて読み、CLI・MCP・VS Code 拡張機能で共通にする](https://github.com/shuhei1101/mdmark/issues/163) は完了している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | 共通スタイルの定義を TypeScript のモジュールに移す計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | mod のプラグイン mdmark-style の計画書 |
