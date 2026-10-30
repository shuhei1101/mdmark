// 表の折りたたみ（実装の render が描く closed・open と title= のモック）: table-build.js が組み立てた表の入れ物のうち、
// data-mock-collapse（"closed" / "open"）を持つものの道具の帯と表を details に入れ、見出しを title= か「表（{本文の行の数} 行）」にする。
// data-mock-title に title= の値を書く。table-build.js の後、refs/19/assets/syntax.js の前に読む

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  for (const wrapper of document.querySelectorAll(".mdmark-table[data-mock-collapse]")) {
    const table = wrapper.querySelector("table");
    const rowCount = [...table.tBodies[0].rows].filter((row) => !row.matches(".mdmark-row-detail, .mdmark-table-empty")).length;
    const details = document.createElement("details");
    details.className = "mdmark-table-details";
    details.open = wrapper.dataset.mockCollapse === "open";
    const summary = document.createElement("summary");
    summary.textContent = wrapper.dataset.mockTitle ?? `表（${rowCount} 行）`;
    details.append(summary);
    // 道具の帯と表を折りたたみの中へ移す（メニュー・ドロワーは画面に重ねて開くので外に置いたまま）
    const bar = wrapper.querySelector(".mdmark-table-bar");
    if (bar) details.append(bar);
    table.before(details);
    details.append(table);
  }
}
