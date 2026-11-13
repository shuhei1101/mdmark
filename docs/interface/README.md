# interface

サブシステムの外部インターフェースと処理フロー（結合テストの元）

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [バージョンを返却する](./IF-472-29.ts.yaml) | 利用側のページが、読み込んだ配布物のバージョンを取る |
| [配布物をビルドする](./IF-472-41.ts.yaml) | バージョンを埋めた dist/index.js と dist/index.css をビルドする |
| [文書を描く](./IF-472-35.ts.yaml) | 利用側のページが、要素の中に Markdown を文書として描く（mount） |
| [文書をHTML文字列にする](./IF-472-34.ts.yaml) | 画面を持たずに Markdown を HTML 文字列にする（render） |
| [拡張を登録する](./IF-472-32.ts.yaml) | 利用側が、自分のマーカーとそのマーカーを描くモジュールの読み込み方を登録する（registerExtension） |
| [参照の表を作る](./IF-472-31.ts.yaml) | 索引と全ての文書の本文から、被参照と用語集の表の用語をまとめた参照の表を作る（collectReferences） |
| [索引を点検する](./IF-472-37.ts.yaml) | 索引と文書の本文から、索引と文書のずれの一覧を返却する（checkIndex） |
| [雛形を配置する](./IF-472-42.ts.yaml) | 文書の作成者が、設定・利用側の CSS・索引・拡張の雛形をフォルダに配置する（mdmark init） |
| [設定と索引を点検する](./IF-472-39.ts.yaml) | 文書の作成者が、設定の構造・索引と文書のずれ・build の対象の有無を点検する（mdmark check） |
| [文書をHTMLに書き出す](./IF-472-33.ts.yaml) | 文書の作成者が、Markdown を 1 つ、外へ要求しない 1 枚の HTML に書き出す（mdmark export） |
| [複数の文書を1枚のHTMLにまとめる](./IF-472-38.ts.yaml) | 文書の作成者が、設定の build の文書を行き来できる 1 枚の HTML にまとめる（mdmark build） |
| [バージョンを上げる](./IF-472-28.ts.yaml) | 文書の作成者が、移行の手順をバージョンの順に適用して設定のバージョンを呼んだ CLI のバージョンにする（mdmark upgrade） |
| [ビューを描く](./IF-472-30.ts.yaml) | 利用側のページと拡張のモジュールが、列名と項目の値から要素の中にボード表示と表形式のビューを描く（mountView） |
| [コメントを付ける](./IF-472-27.ts.yaml) | 利用側のページが、自分の要素と読み込みと保存の関数を指定し、要素の中の選んだ箇所にコメントを付ける（mountComments） |
| [本文の参照を取り出す](./IF-472-36.ts.yaml) | 利用側の処理が、索引と文書の本文から、本文に出た用語・文書の別名の一致と参照先を取り出す（collectMatches） |
| [エイリアスを作る](./IF-472-26.ts.yaml) | 設定の aliases の行と読み込んだ YAML の中身から、metadata を適用したエイリアスの配列を作る（buildAliases） |
| [設定を重ねて読み込む](./IF-472-40.ts.yaml) | 端末の設定と上のフォルダの mdmark.config.yaml を探して重ね、重ねた設定と重ねた設定ファイルの一覧を返却する（loadLayeredConfig） |
| [プレビューを開く](./IF-472-22.ts.yaml) | Markdown の横か同じ列に、読み込むバージョンを決めて mdmark で描くプレビューを開く（mdmark.openPreviewToSide・mdmark.openPreview） |
| [プレビューを再描画する](./IF-472-21.ts.yaml) | Markdown・設定ファイルの書き換えと背面からの復帰で、最後の内容で再描画する |
| [プレビューをリロードする](./IF-472-20.ts.yaml) | 設定ファイルと読み込むバージョンをもう一度決め、配布物を再読み込みして描く（mdmark.refreshPreview） |
| [スクロールを合わせる](./IF-472-17.ts.yaml) | エディタとプレビューのスクロールを、元の行番号で両方向に合わせる |
| [プレビューのリンクを開く](./IF-472-19.ts.yaml) | プレビューの外部の URL・Markdown・`#` のリンクを、種類ごとの先で開く |
| [設定ファイルを開く](./IF-472-25.ts.yaml) | 設定ファイルを開き、無ければ雛形を作るかを尋ねる（mdmark.openConfig） |
| [HTMLに書き出す](./IF-472-15.ts.yaml) | 開いている Markdown を jsDelivr の配布物で描く HTML に書き出す（mdmark.exportHtml） |
| [ブラウザで開く](./IF-472-18.ts.yaml) | もう一度書き出した HTML を既定のブラウザで開く（mdmark.openInBrowser） |
| [PDFに印刷する](./IF-472-16.ts.yaml) | 描き終えた後に印刷のダイアログを出す HTML を書き出して開く（mdmark.printToPdf） |
| [拡張機能の配布物を作る](./IF-472-23.ts.yaml) | `vscode-v*` のタグで .vsix を作り、GitHub Release に添える |
| [設定を開く](./IF-472-24.ts.yaml) | VS Code の設定画面を mdmark の項目に絞って開く（mdmark.openSettings） |
| [点検する](./IF-472-10.ts.yaml) | mdmark check と同じ点検をし、ずれの一覧を返却する（check） |
| [文書をHTMLに書き出す](./IF-472-9.ts.yaml) | mdmark export と同じ処理で 1 文書を 1 枚の HTML に書き出す（export_html） |
| [複数の文書を1枚のHTMLにまとめる](./IF-472-13.ts.yaml) | mdmark build と同じ処理で文書を 1 枚の HTML にまとめる（build_site） |
| [MCPサーバーを起動・停止する](./IF-472-4.ts.yaml) | MCP の常駐サーバーを 127.0.0.1 の Streamable HTTP で起動し、instructions とツールを返却し、シグナルで停止する（mdmark serve） |
| [作業のフォルダを引数に入れる](./IF-472-5.ts.yaml) | 作業のフォルダを使用するツールの引数に、PreToolUse のフックで project_dir を入れる |
| [常駐サーバーの状態を伝える](./IF-472-6.ts.yaml) | SessionStart で常駐サーバーのポートを確認し、待ち受けていないときだけ global-setup での起動の仕方を 1 行で指定する |
| [記法のルールの参照を案内する](./IF-472-43.ts.yaml) | .mark.md への Write・Edit と語 mdmark を含む発言で、記法のルールの参照を 1 セッションに 1 回案内する |
| [端末の状態を調べる](./IF-472-11.ts.yaml) | 端末の設定のパスとバージョン・tmux のセッション名・待ち受けているか・ログの場所を返却する（setup.js status） |
| [設定のキーの一覧を返却する](./IF-472-14.ts.yaml) | 設定の Schema のキーごとに今の値・既定・説明を返却する（setup.js keys） |
| [端末の設定を書き込む](./IF-472-12.ts.yaml) | 回答した値で端末の設定を作る・書き換え、既定のパスでなければ settings.json の env に MDMARK_CONFIG を書き込む（setup.js write-settings） |
| [常駐サーバーを起動する](./IF-472-7.ts.yaml) | tmux のセッションで mdmark serve を起動し、待ち受けと tools/list を確認する（setup.js start-server） |
| [文書のフォルダの設定を書き込む](./IF-472-8.ts.yaml) | 回答した値で文書のフォルダの mdmark.config.yaml を作る・書き換える（setup.js write-config） |
| [CSSのテンプレートの一覧を返却する](./IF-472-1.ts.yaml) | 端末の設定のフォルダの CSS のテンプレートを、名前・説明・タグ・パスつきで返却する（list_templates） |
| [CSSのテンプレートを登録する](./IF-472-2.ts.yaml) | 作業のフォルダの CSS をテンプレートにコピーし、名前・説明・タグを索引に記載する（add_template） |
| [CSSのテンプレートを配置する](./IF-472-3.ts.yaml) | テンプレートの CSS を配置先へコピーし、theme に記載する値を返却する（apply_template） |

<!-- /table -->
