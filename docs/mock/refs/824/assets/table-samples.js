// #824 のモック: スマホの幅で開いたテーブル設定のパネルの列の一覧を、12 列分の行で組む
{
  const names = ["名前", "型", "既定", "必須", "説明", "例", "初出の版", "廃止の版", "設定の場所", "上書き", "関連", "備考"];
  const grip = '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
  const eye = '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
  const build = () => {
    for (const panel of document.querySelectorAll("[data-mock824-columns]")) {
      const note = panel.querySelector(".mdmark-table-settings-note");
      const list = panel.querySelector(".mdmark-table-settings-list");
      list.innerHTML = names.map((name, i) =>
        `<li class="mdmark-table-settings-item" data-column="${i}" data-name="${name}">` +
        `<button class="mdmark-table-settings-grip" type="button" aria-label="「${name}」の列を並べ替える" aria-describedby="${note.id}">${grip}</button>` +
        `<span class="mdmark-table-settings-name">${name}</span>` +
        `<button class="mdmark-table-settings-eye" type="button" aria-pressed="false" aria-label="「${name}」を隠す"${i === 0 ? " disabled" : ""}>${eye}</button></li>`
      ).join("");
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
}
