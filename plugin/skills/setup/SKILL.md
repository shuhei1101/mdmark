---
name: setup
description: 文書のフォルダの mdmark.config.yaml を、キーを 1 つずつ利用者に確認しながら作る・修正する。新しい文書のフォルダで mdmark を使用し始めるときと、文書のフォルダの設定を見直すときに使用する
arguments:
  - dir
argument-hint: "[文書のフォルダ]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js *)
---

# mdmark の文書のフォルダのセットアップ

## 引数

- `$dir`: 設定を作る文書のフォルダ。省くとセッションの作業のフォルダ

## 手順

1. `$dir` が空なら、セッションの作業のフォルダの絶対パスを文書のフォルダにする。
   `setup.js` の結果は標準出力の JSON の 1 行、誤りは標準エラーの文で返る。
   コマンド: `node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js keys --target config --dir {文書のフォルダ}`
2. キーを 1 つずつ、今の値・端末の設定で重なる値（`inherited`）・既定と説明を示して、そのままにするか変えるかを利用者に聞く。
3. 変えるキーと値を示し、書き込んでよいかを利用者に聞く。
   認めたら実行する（`mdmark.config.yaml` が無く変えるキーも無いときは、認めたら `--set` 無しで実行して雛形から作る）。断ったら書き込まない。
   コマンド: `node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js write-config --dir {文書のフォルダ} --set {キー}={値} ...`
4. 書き込んだパスと変えたキーを示す。
