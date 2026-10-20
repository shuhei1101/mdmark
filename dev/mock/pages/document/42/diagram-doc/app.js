// 使う側の固有の部品のモックと、モックの「固有の定義を当てる場所」の切り替え。
// 固有の部品は、実装では使う側が registerExtension で登録し、mount が文書の部品の定義を渡して描かせる

// sample.js・glossary.js・diagram.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 固有の部品の定義（文書に書いた部品の定義の JSON に当たる）
  const MILESTONES = {
    title: "窓口の立ち上げの段取り",
    items: [
      { date: "2026-10-20", name: "よくある質問の表を揃える", state: "済み" },
      { date: "2026-10-27", name: "分類の種類を決めて試す", state: "進行中" },
      { date: "2026-11-04", name: "自動返信を一部の窓口で始める", state: "未着手" },
    ],
  };

  const slot = document.querySelector("[data-team-extension]");
  const teamCss = document.querySelector("[data-team-css]");
  const buttons = document.querySelectorAll("[data-place-set]");

  /** HTML に入れる文字を逃がす。 */
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** 固有の部品の draw に当たる: 定義の題と段取りを描く。 */
  const draw = (def) => {
    slot.innerHTML = `<div class="team-milestones">
      <p class="team-milestones-title">${esc(def.title)}</p>
      <ol>${def.items.map((item) => `<li><time datetime="${item.date}">${item.date}</time><span>${esc(item.name)}</span><span class="team-milestones-state">${esc(item.state)}</span></li>`).join("")}</ol>
    </div>`;
  };

  /** 固有の定義を当てる場所の文書か、別の場所の文書かを切り替える。別の場所では固有の CSS を読まず、部品の場所に何も描かない。 */
  const applyPlace = (place) => {
    teamCss.disabled = place !== "here";
    if (place === "here") draw(MILESTONES);
    else slot.replaceChildren();
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.placeSet === place));
  };

  for (const button of buttons) button.addEventListener("click", () => applyPlace(button.dataset.placeSet));
  applyPlace("here");
}
