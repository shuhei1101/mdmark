// #181 のモック: 文書のテーマ（?colorTheme=）と配色（?scheme=）を URL で切り替える（モックだけの仕組み）
// preview.js と同じページで読むため、名前がぶつからないようブロックの中に置く
{
  const THEMES = ["dev-swiss", "theme-paper", "theme-slate", "theme-contrast"];
  const DEFAULT_THEME = "dev-swiss";
  const SCHEMES = ["light", "dark", "parent-light", "print"];

  const params = new URLSearchParams(location.search);
  // 選んだテーマの名前。未指定は「選ばない」
  const requested = params.get("colorTheme") ?? "";
  // 描くテーマ: 選ばないときと知らない名前（例 sepia）は既定のテーマ
  const theme = THEMES.includes(requested) ? requested : DEFAULT_THEME;

  /** 今の URL の値の 1 つを置き換えた行き先を返す。空の値はその値を外す。 */
  const hrefWith = (key, value) => {
    const next = new URLSearchParams(location.search);
    if (value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    return `?${next.toString()}`;
  };

  // テーマの配色の値: link[data-color-theme-css] の {theme} を描くテーマの名前にする。既定のテーマは採用スタイル本体の値のまま
  const themeLink = document.querySelector("link[data-color-theme-css]");
  if (themeLink && theme === DEFAULT_THEME) {
    themeLink.remove();
  } else if (themeLink) {
    themeLink.href = themeLink.dataset.colorThemeCss.replace("{theme}", theme);
  }

  // テーマのリンク（操作列）: 行き先と、今選んでいる名前の aria-current
  for (const link of document.querySelectorAll("[data-color-theme-value]")) {
    link.href = hrefWith("colorTheme", link.dataset.colorThemeValue);
    if (link.dataset.colorThemeValue === requested) {
      link.setAttribute("aria-current", "page");
    }
  }

  // 描いたテーマの名前の表示（操作列）
  for (const output of document.querySelectorAll("[data-color-theme-applied]")) {
    output.textContent = theme;
  }

  // テーマの選択欄（VS Code の設定画面）: 今の値を出し、変えたら描き直した場面へ移る
  for (const select of document.querySelectorAll("select[data-color-theme-select]")) {
    select.value = requested;
    select.addEventListener("change", () => {
      location.search = hrefWith("colorTheme", select.value);
    });
  }

  // テーマを選ぶボタン（歯車のメニュー）: 選んでいる値のボタンを押された状態にし、押したら描き直した場面へ移る
  for (const button of document.querySelectorAll("button[data-color-theme-choose]")) {
    button.setAttribute("aria-pressed", String(button.dataset.colorThemeChoose === requested));
    button.addEventListener("click", () => {
      const next = new URLSearchParams(hrefWith("colorTheme", button.dataset.colorThemeChoose));
      next.set("scene", "preview");
      location.search = `?${next.toString()}`;
    });
  }

  // 場面を移すボタン（歯車・すべての設定を開く）: 押したら [data-scene-go] の場面へ移る
  for (const button of document.querySelectorAll("button[data-scene-go]")) {
    button.addEventListener("click", () => {
      location.search = hrefWith("scene", button.dataset.sceneGo);
    });
  }

  // 配色のリンクを持つ画面（文書）だけ、?scheme= で明暗と印刷を切り替える
  const schemeLinks = document.querySelectorAll("[data-scheme-value]");
  if (schemeLinks.length > 0) {
    const scheme = SCHEMES.includes(params.get("scheme")) ? params.get("scheme") : "light";
    // 親の class・印刷はどちらも明るい配色で描く
    document.documentElement.dataset.scheme = scheme === "dark" ? "dark" : "light";
    // 親の class で明るい配色: 描く先の親に mdmark-theme-light を付ける（OS はダークの想定）
    document.querySelector("[data-mount-parent]")?.classList.toggle("mdmark-theme-light", scheme === "parent-light");
    // 印刷: 印刷したときの見え方（折り畳みを開き、リンクの URL を併記する）を画面に出す
    document.body.classList.toggle("is-print-preview", scheme === "print");
    if (scheme === "print") {
      for (const details of document.querySelectorAll(".mdmark details")) {
        details.open = true;
      }
    }
    for (const link of schemeLinks) {
      link.href = hrefWith("scheme", link.dataset.schemeValue);
      if (link.dataset.schemeValue === scheme) {
        link.setAttribute("aria-current", "page");
      }
    }
  }

  // 場面が「テーマの一覧を開いた」のとき、歯車のメニューを開いた状態で出す
  if (params.get("scene") === "menu") {
    document.querySelector("[data-open-on-menu-scene]")?.showPopover();
  }
}
