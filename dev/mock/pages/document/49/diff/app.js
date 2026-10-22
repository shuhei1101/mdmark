// モックの操作列の切り替え（場面・差分の出し方・プレビューの並べ方）と、場面の取り出し元を渡して「変更を見る」を付ける。
// URL の ?case= で取り出し元の場面、?layout=stack で文書の上に並べる出し方、?sides=stack でプレビューを縦に並べる。
// ?before= ?after= で開いた時点に選ぶリビジョン、?open=1 で開いた状態から始める

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const params = new URLSearchParams(location.search);
  const page = location.pathname.split("/").pop() || "index.html";

  // 操作列のリンク: 今の状態を押された見た目にし、行き先に今のほかの切り替えを残す
  for (const link of document.querySelectorAll("[data-param]")) {
    const { param, value } = link.dataset;
    const isDefault = link.hasAttribute("data-default");
    const next = new URLSearchParams(params);
    if (isDefault) next.delete(param);
    else next.set(param, value);
    // 場面を変えたら、選んだリビジョンを既定に戻す
    if (param === "case") {
      next.delete("before");
      next.delete("after");
    }
    const query = next.toString();
    link.href = query ? `?${query}` : page;
    if ((params.get(param) ?? (isDefault ? value : null)) === value) link.setAttribute("aria-current", "page");
  }

  // 場面の取り出し元を渡す。取り出し元を渡さない場面では「変更を見る」を付けない
  const caseName = params.get("case") ?? "normal";
  if (caseName !== "no-source") {
    const config = window.mockDiffCases[caseName];
    window.mockDiff.attach(document.querySelector("article.mdmark"), window.mockDiffSource(config), {
      layout: params.get("layout") ?? "replace",
      sides: params.get("sides") ?? "side",
      segmenter: config.segmenter ?? true,
      before: params.get("before") ?? undefined,
      after: params.get("after") ?? undefined,
      open: params.get("open") === "1",
    });
  }
}
