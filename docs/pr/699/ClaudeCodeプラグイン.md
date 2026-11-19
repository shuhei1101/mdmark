# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [.claude-plugin/marketplace.json](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/.claude-plugin/marketplace.json) | マーケットプレイスの定義。`plugins` は `mdmark`（`./plugin`）だけ | `mdmark-style` の行を追加する |
| 実装 | [plugin/](https://github.com/shuhei1101/mdmark/tree/560c24a9b8730808b8999fc7dcb35290103cfc7b/plugin) | プラグイン `mdmark`（MCP・フック・スキル） | 変更しない |
| ドキュメント | [docs/architecture/ARCH-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/architecture/ARCH-472-1.yaml) | アーキテクチャ図。サブシステム「Claude Code プラグイン」は MCP とフックを持つ | mdmark-style を加える |
| ドキュメント | [docs/library/LIB-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/library/LIB-472-1.yaml) | 外部ライブラリ『ClaudeCode』。確認したバージョンは 2.1.309 | mod の API を記録する |
| ドキュメント | [docs/nonfunctional/NFR-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/nonfunctional/NFR-472-1.yaml) | 非機能要件 | 確認した Claude Code のバージョンを見直す |
| ドキュメント | [docs/scenario/SC-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/560c24a9b8730808b8999fc7dcb35290103cfc7b/docs/scenario/SC-472-4.yaml) | ClaudeCodeにプラグインを入れる | mdmark-style を選んで入れる流れを追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プラグインの配置先 | リポジトリの直下に mdmark-style のフォルダを作り、`marketplace.json` の `plugins` に行を追加する。`plugin.json`・`plugins[]` に `version` を持たせない | フォルダ名はモジュール構成設計で決める |
| 返答の描き換え | `ui.render` の `AssistantMessage` で、返答の Markdown を解析して表・見出し・注意書き・コードを共通スタイルの部品の木にし、ほかのブロック（段落・箇条書き）は `Markdown` 部品で Claude Code の標準の返答と同じ描き方にする | 部品の木の上限（20,000 ノード・深さ 32・100,000 文字）を超えるときは元の描画に任せる |
| マーカー | 返答の `<!-- ... -->` の mdmark のマーカーを参照して描き方（表の種類・注意書き 等）に使用し、マーカーの行と行内のマーカーを画面に出さない | 対応するマーカーの一覧は単一ユースケース設計で決める。`AssistantMessage.text` は画面が隠す部分を除いた本文のため、マーカーが残って届くかを PoC で確認する |
| 用語のマーカー | `AssistantMessage`・`UserMessage` の本文の用語に下線を付け、hover で開くカードと、本文の後ろの脚注を出す。下線はメッセージごとに最初の出現だけに付け、見出し・表・コードの中には付けない（Web の用語のツールチップと同じ規則）。カードは背景色で後ろの行を隠し、行の頭から行のすぐ下に出す。発言は標準の描画の背景の帯を残す（`next(e)` の描画を包むか、同じ背景色で描く） | カードと脚注の状態と引数は部品設計・画面設計で決める |
| マーカーの記載方法の注入 | mod の `classic.SessionStart` の結果の `additionalContext` で、マーカーの記載方法の短い説明を注入する。SessionStart は起動・再開・`/clear`・圧縮の後に発火するため、発火ごとに 1 回注入する（`/clear`・圧縮でモデルの文脈から消えた説明を入れ直す） | `inject_marker_guide: false` で止める。`session.start` の戻り値は文脈を変えないため使用しない |
| 設定 | `MDMARK_STYLE_CONFIG` が指す `settings.yaml`（無ければ `~/.config/mdmark-style/settings.yaml`）の `global`・`projects` を、knowledge の規約『Claude プラグインルール』の `## 設定ファイル` のとおりに重ねて参照する | 設定の設計書は新規の `docs/config/CFG-472-4.yaml` |
| 描けない部品 | 図（mermaid・map）・埋め込んだ HTML は描き換えない | - |
| 既存のプラグイン mdmark | 変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `560c24a9..ec1948d5` | - |
| 単一ユースケース設計 | `6aac646b..da22c065` | レビューの指摘の修正 |
| 単一ユースケース設計 | `995d4086..304b316d` | 利用者の端末での確認の結果の反映 |

## PoC 結果

Claude Code 2.1.328 のターミナル版（tmux の 160 列）に `--plugin-dir` で PoC の mod を読み込み、Haiku 5.5 に固定の Markdown を返答させて確認した（2026-11-19）。

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| マーカーの受け取り | `AssistantMessage` の `e.props.text` に行内と単独の行の `<!-- ... -->` が元の文字のまま含まれる | ✅ 2 つとも含まれる | [#701](https://github.com/shuhei1101/mdmark/pull/701) | `evidence/assistant-text.txt` |
| 返答の描き換え | 表が罫線、注意書きが左の縦線とラベル、見出しが太字、コードが Code 部品で描かれる | ✅ 4 つとも描かれる | 同上 | 見出しは太字と色、コードは言語の色分けつき（`evidence/screen-reply.ansi`） |
| マーカーで描き方が変わる | `<!-- table: {"kind": "data"} -->` が有る表だけ先頭の行が太字になる | ✅ マーカーの有る表だけ太字 | 同上 | 同上 |
| マーカーを画面に出さない | `<!--` の文字が画面に 0 件 | ✅ 0 件 | 同上 | 同上 |
| 発言の描き換え | `UserMessage` の固定の 1 単語に下線が付く | ✅ 下線（`ESC[4m`） | 同上 | 脚注の行も描かれる |
| hover のカード（tmux） | `ESC[?1003h` が有効で、用語の座標への移動でカードが出て、範囲外の座標への移動で消える | ✅ 出る・消える | 同上 | `evidence/mouse-modes.txt`・`hover-on.txt`・`hover-off.txt` |
| hover のカード（利用者の端末） | WSL の Windows Terminal・VS Code の統合ターミナルでカードが出る | ✅ VS Code の統合ターミナルで出る（Windows Terminal は未確認） | 同上 | 利用者が確認した（[確認の結果](https://github.com/shuhei1101/mdmark/pull/699#discussion_r4626225053)）。カードの上の枠線が欠け、後ろの行と透けて重なる。発言の背景の帯と、返答の太字・箇条書き・行内のコードが消える |
| マーカーの記載方法の注入 | `classic.SessionStart` の `additionalContext` の固定の単語を回答でき、`/clear` の後も回答できる | ✅ 2 回とも回答 | 同上 | SessionStart は `startup` と `clear` で 1 回ずつ発火（`evidence/session-start.txt`） |
| 元の描画への切り替え | mod が例外を投げたとき、元の描画で返答が出る | ✅ 元の描画で出る | 同上 | 画面に `ui.render hook skipped: threw Error` の 1 行が出る（`--plugin-dir` で読み込んだとき） |

結論は成立。
`ui.render` の部品の木で返答・発言を描き換え、受け取った本文のマーカーで描き方を変え、マーカーを画面から削除できる。
hover のカードは、マウスの移動を送信する端末で動く。
設計で扱う点が 2 つ見つかった。

- 表の列の幅を文字数で計算すると、全角の文字の列が狭くなる。列の幅は端末の表示幅（全角を 2 つ分）で計算する
- 他の mod（alias-inject）が描く行と同じ返答の中に並ぶため、mod の描き換えは自分の受けた本文の範囲だけに留める

最小再現コードの要点（[52e97244](https://github.com/shuhei1101/mdmark/commit/52e97244) の `poc/mdmark-style-mod/hooks/mod.tsx`）:

```tsx
on('classic.SessionStart', async ($, e, next) => {
  const result = await next(e)
  return { ...result, additionalContext: [...(result.additionalContext ?? []), GUIDE] }
})

on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
  const { Box, Text, Code } = $.ui.resolve(e)
  // e.props.text の Markdown をブロックに分け、マーカーの行は描かず、直後の表の描き方に使う
  return <Box flexDirection="column">{parse(e.props.text).map(drawBlock)}</Box>
})

on('ui.render', { component: 'UserMessage' }, async ($, e, next) => (
  <Box key="term">
    <Text underline>{TERM}</Text>
    <Box position="absolute" top={1} left={0} display="none" hover={{ display: 'flex' }} borderStyle="round">
      <Text>CARD: {TERM_MEANING}</Text>
    </Box>
  </Box>
))
```

PoC PR の見どころは `hooks/mod.tsx` の `parse`（マーカーの行と直後の表の対応）と、`UserMessage` の keyed `Box` の中の非表示の `Box`（hover のカード）。

## テスト結果

なし
