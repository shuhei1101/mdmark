---
name: setup
description: 文書のフォルダの mdmark.config.yaml を、キーを 1 つずつ利用者に確認しながら作る・修正する。新しい文書のフォルダで mdmark を使い始めるときと、文書のフォルダの設定を見直すときに使う
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js *)
---

# mdmark の文書のフォルダのセットアップ

決まった処理は `node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js {サブコマンド}` で流す。
文書のフォルダは、引数で渡されたフォルダか、無ければセッションの作業のフォルダ。

## 手順

1. `setup.js keys --target config --dir {文書のフォルダ}` を流す
2. キーを 1 つずつ、今の値・端末の設定で重なる値（`inherited`）・既定と説明を示して、そのままにするか変えるかを利用者に聞く
3. 変えるキーと値を示し、書いてよいかを利用者に聞く
4. 認めたら `setup.js write-config --dir {文書のフォルダ} --set {キー}={値} ...` を流す（`mdmark.config.yaml` が無く変えるキーも無いときは、認めたら `--set` 無しで流して雛形から作る）。断ったら書かない
5. 書いたパスと変えたキーを示す
