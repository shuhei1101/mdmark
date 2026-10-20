// モックの「HTML の表示」「ヒント」の切り替え（設定の features.html・features.hints に当たる）。
// URL の ?html=off で、印の範囲の HTML を描かずコードのまま出す。?hints=off で、描く先の要素に data-mock-hints="off" を付ける。
// diagram.js・embed.js より先に読み、描く前に文書を切り替える

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const params = new URLSearchParams(location.search);
  const htmlOn = params.get("html") !== "off";
  const hintsOn = params.get("hints") !== "off";

  // 機能 html がオフ: 描いた HTML を外し、同じ範囲のコードブロックを出す
  if (!htmlOn) {
    for (const rendered of document.querySelectorAll("[data-mock-source]")) {
      document.querySelector(`[data-mock-source-of="${rendered.dataset.mockSource}"]`).hidden = false;
      rendered.remove();
    }
  }

  // 機能 hints がオフ: diagram.js と embed.js がヒントを付けない
  if (!hintsOn) document.querySelector("article.mdmark").dataset.mockHints = "off";

  /** 今の切り替えを保ったまま、1 つの機能だけを変えた URL を返す。 */
  const urlWith = (key, on) => {
    const next = new URLSearchParams(params);
    if (on) next.delete(key);
    else next.set(key, "off");
    const query = next.toString();
    return query ? `?${query}` : location.pathname.split("/").pop() || "index.html";
  };

  // 操作列のリンク: 今の状態を押された見た目にし、行き先に今のほかの切り替えを残す
  for (const link of document.querySelectorAll("[data-feature]")) {
    const on = link.dataset.value === "on";
    const current = link.dataset.feature === "html" ? htmlOn : hintsOn;
    link.href = urlWith(link.dataset.feature, on);
    if (on === current) link.setAttribute("aria-current", "page");
  }
}
