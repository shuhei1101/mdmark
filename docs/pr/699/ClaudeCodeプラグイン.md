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
| プラグインの配置先 | リポジトリの直下に mdmark-style のフォルダを作り、`marketplace.json` の `plugins` に行を追加する。`plugin.json`・`plugins[]` に `version` を持たせない | フォルダ名は `mdmark-style`（ソースは `src/mdmark-style/`、ビルドが `mdmark-style/hooks/mod/mod.js` に書き込む） |
| 返答の描き換え | `ui.render` の `AssistantMessage` で、返答の Markdown を解析して表・見出し・注意書き・コードを共通スタイルの部品の木にし、ほかのブロック（段落・箇条書き）は `Markdown` 部品で Claude Code の標準の返答と同じ描き方にする | 部品の木の上限（20,000 ノード・深さ 32・100,000 文字）を超えるときは元の描画に任せる |
| マーカー | 返答の `<!-- ... -->` の mdmark のマーカーを参照して描き方（表の種類・注意書き 等）に使用し、マーカーの行と行内のマーカーを画面に出さない | 対応するマーカーの一覧は単一ユースケース設計で決める。`AssistantMessage.text` は画面が隠す部分を除いた本文のため、マーカーが残って届くかを PoC で確認する |
| 用語のマーカー | `AssistantMessage`・`UserMessage` の本文の用語に下線を付け、hover で開くカードと、本文の後ろの脚注を出す。下線はメッセージごとに最初の出現だけに付け、見出し・表・コードの中には付けない（Web の用語のツールチップと同じ規則）。カードは背景色で後ろの行を隠し、行の頭から行のすぐ下に出す。発言は標準の描画の背景の帯を残す（`next(e)` の描画を包むか、同じ背景色で描く） | カードと脚注の状態と引数は部品設計・画面設計で決める |
| マーカーの記載方法の注入 | mod の `classic.SessionStart` の結果の `additionalContext` で、マーカーの記載方法の短い説明を注入する。SessionStart は起動・再開・`/clear`・圧縮の後に発火するため、発火ごとに 1 回注入する（`/clear`・圧縮でモデルの文脈から消えた説明を入れ直す） | `inject_marker_guide: false` で止める。`session.start` の戻り値は文脈を変えないため使用しない |
| 設定 | `MDMARK_STYLE_CONFIG` が指す `settings.yaml`（無ければ `~/.config/mdmark-style/settings.yaml`）の `global`・`projects` を、knowledge の規約『Claude プラグインルール』の `## 設定ファイル` のとおりに重ねて参照する | 設定の設計書は新規の `docs/config/CFG-472-4.yaml` |
| 狭い画面の表 | デスクトップ版は表の Box を `overflowX: "scroll"` にし、ターミナル版・VS Code は端末の幅から列の幅を決めてセルの中で折り返す | mod の型定義では、ターミナル版・VS Code は横にスクロールできず、`overflowX: "scroll"` だと端で文字を切る。画面の種類の見分け方はインターフェース定義設計で決める |
| 開閉の範囲 | details の範囲・セクションの開閉・注意書きの `closed` を、押すと開閉の状態を切り替えて描き直す Button で描く | Button の押下と描き直しは PoC 結果の「開閉の範囲」の行で確認済み |
| 描けない部品 | 図（mermaid・map）・埋め込んだ HTML は描き換えない | - |
| 既存のプラグイン mdmark | 変えない | - |
| 配布物のワークフロー | 実装の工程で `.github/workflows/develop-dist.yml` の `git add --all dist plugin migrations` に `mdmark-style` を加え、develop への push でビルドした `mdmark-style/hooks/mod/mod.js` を commit する | アーキテクチャ図 ARCH-472-1 の `mdmark-style/`・`.github/workflows/` の行 |

## mdmark の機能との対応

✅ はこの PR で描く機能、➕ は mod の API で描けるが別の Issue に切り出した機能、— は描かない機能。

<!-- table: {"kind": "data"} -->

| mdmark の機能 | Claude Code の画面での再現 |
| --- | --- |
| 表 | ✅ 罫線で描き、`kind` で見出しの行を強調する。狭い画面では、デスクトップ版は横にスクロールし、ターミナル版・VS Code はセルの中で折り返す。並べ替え・絞り込み・ピン止め・集計の行・コピーは描かない |
| 注意書き | ✅ 種類の色の縦線と先頭のラベルで描き、`closed` の折り畳みを開閉の Button で描く |
| 脚注 | ✅ 上付きの番号の代わりに `[1]` を付け、本文の後ろに一覧を出す |
| 用語集の表 | ✅ 用語の下線・hover のカード・脚注（`mdmark.config.yaml` の索引・エイリアス・用語集の表） |
| コードブロックの飾り | ✅ 言語の色分けと背景の面・言語のラベル・タイトル・行番号・行の強調・`[!code ++]` などの行の色・コピーの Button。行の畳みは描かない |
| 見出しのアンカー | ✅ 見出しを太字と色で描く（アンカーは付けない） |
| details の範囲・セクションの開閉 | ✅ 開閉の Button（`[ ▸ タイトル ]`）で描く |
| 行の詳細 | ➕ 開閉の Button で表の行の下に描く |
| ステップ | ➕ 番号を色付きの手順として描く |
| ファイルツリー | ➕ 罫線のツリーとして描き、注釈を薄い色にする（開閉・アイコンは描かない） |
| バッジ・文字の色・蛍光ペン・キー | ➕ 色の名前の文字色・背景色と、`[Ctrl]` の囲みで描く |
| タブ・段組み・カードの格子・wide の範囲・ビュー・CSV の表 | ➕ 切り替え・横並びにせず、中身を見出しつきで縦に並べる（ビュー・CSV は表として描く） |
| 図と表の番号 | ➕ 表の前に番号を付ける |
| リンクと添付のカード | — リンクの色で描く（Claude Code の標準の描き方） |
| 目次・先頭へ戻るボタン | — 端末に右側の領域が無い |
| 画像・ギャラリー・動画と音声・GIF | — Claude Code の標準の描き方のまま |
| 図の部品・mermaid のコードブロック・埋め込んだ HTML・ヒント | — コードブロックのまま描く（端末の文字では図を描けない） |
| アイコン・ルビ | — 名前・親文字の文字のまま |
| 取り込み・ページの設定・改ページ・拡張のマーカー | — マーカーの行を削除するだけ |
| 書き方の警告 | — Claude Code のデバッグログに出す |

<!-- /table -->

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `560c24a9..ec1948d5` | - |
| 単一ユースケース設計 | `6aac646b..da22c065` | レビューの指摘の修正 |
| 単一ユースケース設計 | `995d4086..304b316d` | 利用者の端末での確認の結果の反映 |
| インターフェース定義設計 | `3a5fc46e..aef1c1a8` | 設定 CFG-472-4 と、要件に加えた機能のシナリオ SC-472-97 の修正を含む |
| 画面設計 | `0ddccfbc..371c5204` | 部品設計は不要と判断（タスク一覧の理由） |
| 画面設計 | `198c7045..555d3ebf` | レビューの指摘の修正 |
| モジュール構成設計 | `fbe6ce45..7ba0876c` | フォルダ構成 LAY-472-1・プラグインのビルド MOD-472-14 の修正と、画面設計 SCR-472-5 の `screen` の修正を含む |
| モジュール構成設計 | `72d4c94b..034e451f` | レビューの指摘の修正 |
| モジュール構成設計 | `bbeea717..685e9245` | 実装で `claude plugin validate` に合わせたシグネチャの変更（`$` を受け取る関数を `function` 宣言・先頭の引数にする）と、`termMarksOf`・`renderFootnotes` の追加 |

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
| 開閉の範囲（Button の押下と描き直し） | `UserMessage` の keyed Box の中の Button を押すと、`onPress` で開閉の状態を切り替えて `$.ui.invalidate("ui.render")` で描き直し、範囲が開く・閉じる | ✅ 開く・閉じる | - | ターミナル版（tmux の 120 列）に `--plugin-dir` で確認用の mod を読み込み、SGR のマウスの押下で確かめた（2026-11-19）。ターミナル版は Button を `[ ▸ ラベル ]` で描く |
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

単体テストの Red: [20261119213541_904d912b_単体テスト.log](テスト結果/20261119213541_904d912b_単体テスト.log)（53 件が実装の無いことだけで fail）。

実装で直したテスト（9d0af17f。実装と別の commit）:

| テスト | 理由 |
| --- | --- |
| `tests/unit/src/mdmark-style/terms.test.ts` | `loadGlossary` の引数を、`claude plugin validate` が求める `$` を先頭にした形（`loadGlossary($, { configPath })`）に合わせた |
| `tests/unit/src/mdmark-style/reply.test.ts` の `test_render_block_table_when_desktop` | 表の行の Text の中にセルの Text を入れ子にするため、同じ文字列を持つ Text が 2 つ数えられた。最も長い行に全てのセルの文字があることを確かめる形にした |
| `tests/unit/src/mdmark-style/fake-engine.ts`・`reply.test.ts` | Button の `onPress` を呼ぶ補助 `pressButton` を足し、biome の `noUnsafeOptionalChaining` を解消した |

ドキュメント修正（アーキテクチャ図 ARCH-472-1・フォルダ構成 LAY-472-1・外部ライブラリ LIB-472-1）では、規約『V字モデル』の対応表で関係する単体・結合テストが無い（設計書の YAML だけを変え、コードを変えない）ため、テストを回していない。
