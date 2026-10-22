// 用語のツールチップの関連文書の絞り込み（実装の mount が付ける振る舞いのモック）: 入力欄に打った文字を題か説明に含む文書だけを残し、
// 件数と一致なしの文字を出し分ける。絞り込んでもツールチップの幅と高さは打つ前のまま保ち、閉じたら入力欄を空にして全件に戻す。
// 用語のツールチップの操作（refs/27/assets/glossary.js）の後に読む

// sample.js・glossary.js と同じ大域に読むため、宣言をブロックに閉じる
{
  /** 件数の文言を返す。絞り込んでいないときは全件だけ、絞り込んだときは全件中の残った件数。 */
  const countText = (total, shown, filtered) => (filtered ? `${total} 件中 ${shown} 件` : `${total} 件`);

  /** 打つ前のツールチップの幅と高さを、絞り込んでも変わらないよう固定する。 */
  const lockSize = (tip) => {
    if (tip.style.height) return;
    const { width, height } = tip.getBoundingClientRect();
    tip.style.width = `${width}px`;
    tip.style.height = `${height}px`;
  };

  /** 入力欄の文字で関連文書を絞り込み、件数と一致なしの文字を出し分ける。英字の大文字と小文字は区別しない。 */
  const applyFilter = (tip) => {
    const query = tip.querySelector(".mdmark-term-tip-filter input").value.trim().toLowerCase();
    const docs = [...tip.querySelectorAll(".mdmark-term-tip-doc")];
    let shown = 0;
    for (const doc of docs) {
      const match = doc.textContent.toLowerCase().includes(query);
      doc.hidden = !match;
      if (match) shown += 1;
    }
    tip.querySelector(".mdmark-term-tip-none").hidden = shown > 0;
    tip.querySelector(".mdmark-term-tip-count").textContent = countText(docs.length, shown, query !== "");
  };

  /** 入力欄を空にし、全ての文書を並べ直して、固定した幅と高さを外す。 */
  const reset = (tip) => {
    tip.querySelector(".mdmark-term-tip-filter input").value = "";
    applyFilter(tip);
    tip.style.width = tip.style.height = "";
  };

  for (const tip of document.querySelectorAll(".mdmark-term-tip:has(.mdmark-term-tip-filter)")) {
    const wrap = tip.closest(".mdmark-term-wrap");
    const input = tip.querySelector(".mdmark-term-tip-filter input");

    // [data-mock-static]: 部品のモックで打った後を見せる見本。書いた value で絞り込んだ状態を最初から出す
    if (wrap.hasAttribute("data-mock-static")) {
      lockSize(tip);
      applyFilter(tip);
      continue;
    }

    input.addEventListener("input", () => {
      lockSize(tip);
      applyFilter(tip);
    });

    // ツールチップを閉じた（is-open が外れた）とき: 次に開いたときは絞り込まれていない
    new MutationObserver(() => {
      if (!wrap.classList.contains("is-open")) reset(tip);
    }).observe(wrap, { attributes: true, attributeFilter: ["class"] });
  }
}
