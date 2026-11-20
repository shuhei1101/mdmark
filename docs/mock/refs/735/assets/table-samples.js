// #735 の表の見本の定義（#283 の table-pin.js が描く。#283 の table-samples.js の後、table-pin.js の前に読み込む）。
// default-pin の表と同じ列と行で、既定（どの列も留めない）と、設定で既定の列を留める指定をした表を並べる

{
  const T = window.mdmarkMockTables283;
  const base = T["default-pin"];
  T["735-default-unpinned"] = { ...base, label: "はみ出す表の既定（どの列も留めない）", pinned: 0 };
  T["735-setting-pinned"] = { ...base, label: "設定で既定の列を留める指定をした表", pinned: 1 };
}
