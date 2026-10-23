// プレビューのパネルのモック: VS Code のテーマと場面を URL（?theme= / ?scene=）で切り替える（モックだけの仕組み）

const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
const sceneLinks = document.querySelectorAll("[data-scene-value]");
const scenes = document.querySelectorAll("[data-scene]");
// 場面を持たない画面（部品のカタログ）は、場面の既定を持たない
const scene = params.get("scene") ?? sceneLinks[0]?.dataset.sceneValue;

/** 今の URL の値の 1 つを置き換えた行き先を返す。 */
const hrefWith = (key, value) => {
  const next = new URLSearchParams(location.search);
  next.set(key, value);
  return `?${next.toString()}`;
};

// VS Code が Webview の body に付ける class を当てる。モックでは採用スタイルの値を使うため html の data-scheme も揃える
document.body.classList.add(`vscode-${theme}`);
document.documentElement.dataset.scheme = theme;

// テーマのリンク: 行き先と、今のテーマの aria-current
for (const link of document.querySelectorAll("[data-theme-value]")) {
  link.href = hrefWith("theme", link.dataset.themeValue);
  if (link.dataset.themeValue === theme) {
    link.setAttribute("aria-current", "page");
  }
}

// 場面のリンク: 行き先と、今の場面の aria-current
for (const link of sceneLinks) {
  link.href = hrefWith("scene", link.dataset.sceneValue);
  if (link.dataset.sceneValue === scene) {
    link.setAttribute("aria-current", "page");
  }
}

// 場面の中身: 今の場面に当たるものだけを出す（1 つの中身を複数の場面で使うときは空白で区切る）
for (const section of scenes) {
  section.hidden = !section.dataset.scene.split(" ").includes(scene);
}
