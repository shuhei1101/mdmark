// 図の右上に重ねるボタンのパネルのモックの操作（#659）
// 案 C（[data-mock-panel="c"]）の図に、パネルを開閉するボタンを追加する。[data-mock-open] の figure は開いた状態で描く（モックだけの指定）
const MORE_LABEL_OPEN = "表示の操作を開く";
const MORE_LABEL_CLOSE = "表示の操作を閉じる";

const addMoreButton = (figure) => {
  const tools = figure.querySelector(".mdmark-diagram-tools");
  const group = document.createElement("div");
  group.className = "mdmark-diagram-tools-group";
  group.dataset.group = "more";
  const button = document.createElement("button");
  button.className = "mdmark-diagram-tool";
  button.type = "button";
  button.dataset.tool = "more";
  // 横に並んだ 3 点のアイコン（24 の格子の線のアイコン）
  button.innerHTML = '<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
  const setOpen = (open) => {
    tools.toggleAttribute("data-mock-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? MORE_LABEL_CLOSE : MORE_LABEL_OPEN);
  };
  button.addEventListener("click", () => setOpen(!tools.hasAttribute("data-mock-open")));
  group.append(button);
  tools.append(group);
  setOpen(figure.hasAttribute("data-mock-open"));
};

addEventListener("load", () => {
  for (const figure of document.querySelectorAll('[data-mock-panel="c"] figure[data-mock-diagram]')) addMoreButton(figure);
});
