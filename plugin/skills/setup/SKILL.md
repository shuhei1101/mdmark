---
name: setup
description: 文書のフォルダの mdmark.config.yaml を、キーを 1 つずつ利用者に確認しながら作る・修正する。新しい文書のフォルダで mdmark を使用し始めるときと、文書のフォルダの設定を見直すときに使用する
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js *)
---

# mdmark の文書のフォルダのセットアップ

決まった処理は `node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js {サブコマンド}` で実行する。
文書のフォルダは、引数で指定されたフォルダか、無ければセッションの作業のフォルダ。

## 手順

1. `setup.js keys --target config --dir {文書のフォルダ}` を実行する
2. キーを 1 つずつ、今の値・端末の設定で重なる値（`inherited`）・既定と説明を示して、そのままにするか変えるかを利用者に聞く
3. 変えるキーと値を示し、書き込んでよいかを利用者に聞く
4. 認めたら `setup.js write-config --dir {文書のフォルダ} --set {キー}={値} ...` を実行する（`mdmark.config.yaml` が無く変えるキーも無いときは、認めたら `--set` 無しで実行して雛形から作る）。断ったら書き込まない
5. 書き込んだパスと変えたキーを示す
