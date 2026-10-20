// 差分の部品のカタログ: [data-mock-case] の場所ごとに、場面の取り出し元から差分の場所を開いた状態で描く。
// data-mock-before / data-mock-after で選ぶリビジョン、data-mock-view で埋め込んだ HTML の見方、data-mock-sides で描いた結果の並べ方を指す

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  for (const panel of document.querySelectorAll("[data-mock-case]")) {
    const config = window.mockDiffCases[panel.dataset.mockCase];
    window.mockDiff.openPanel(panel, window.mockDiffSource(config), {
      loadingDelay: 0,
      segmenter: config.segmenter ?? true,
      before: panel.dataset.mockBefore,
      after: panel.dataset.mockAfter,
      htmlView: panel.dataset.mockView,
      sides: panel.dataset.mockSides,
    });
  }
}
