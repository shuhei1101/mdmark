// まとめた HTML のモックの操作: URL の # で開く文書と見出しを決め、文書の一覧のパネルを開閉し、印刷の見え方を切り替える

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 開いたときに出す文書（設定の build.entry）
  const ENTRY = "README.md";
  // 文書を指す URL の # の頭
  const DOC_PREFIX = "#/";

  const root = document.documentElement;
  const view = document.querySelector("[data-doc-view]");
  const barTitle = document.querySelector("[data-bar-title]");
  const panel = document.querySelector("#doc-list-panel");
  const openButton = document.querySelector("[data-panel-open]");
  const docs = new Map([...document.querySelectorAll("template[data-doc-path]")].map((template) => [template.dataset.docPath, template]));
  let current = null;

  // 横の文書の一覧をパネルへ写す（実装では同じ一覧を 1 つだけ持ち、幅で置き場所を替える）
  document.querySelector("[data-panel-body]").append(document.querySelector("[data-doc-list]").cloneNode(true));

  /** URL の # から、開く文書のパスと見出しの ID を読む。1 枚に無い文書を指すときは entry の文書にする。 */
  const parse = () => {
    const hash = decodeURIComponent(location.hash);
    if (!hash.startsWith(DOC_PREFIX)) return { path: ENTRY, heading: null, missing: false };
    const rest = hash.slice(DOC_PREFIX.length);
    const separator = rest.indexOf("#");
    const path = separator < 0 ? rest : rest.slice(0, separator);
    const heading = separator < 0 ? null : rest.slice(separator + 1);
    if (!docs.has(path)) return { path: ENTRY, heading: null, missing: true };
    return { path, heading, missing: false };
  };

  /** 文書を差し替え、一覧の開いている文書・帯の題・ページの題を合わせる。 */
  const showDocument = (path) => {
    const template = docs.get(path);
    view.replaceChildren(template.content.cloneNode(true));
    current = path;
    // 両方の一覧（横とパネル）で、開いている文書の行だけに aria-current を付ける
    for (const link of document.querySelectorAll(".mdmark-doc-list a")) {
      if (link.dataset.docPath === path) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    barTitle.textContent = template.dataset.docTitle;
    document.title = `${template.dataset.docTitle} | mdmark の文書`;
  };

  /** URL の # のとおりに文書を出し、見出しを指していればそこへ移る。 */
  const route = (initial) => {
    const { path, heading, missing } = parse();
    // 1 枚に無い文書を指す URL: entry の文書を出し、URL も entry に合わせる（履歴に積まない）
    if (missing) history.replaceState(null, "", `${DOC_PREFIX}${ENTRY}`);
    const switched = path !== current;
    if (switched) showDocument(path);
    // 見出しを指していればその見出しへ、文書だけが替わったときは頭へ移る
    if (heading) {
      document.getElementById(heading)?.scrollIntoView();
    } else if (switched) {
      window.scrollTo(0, 0);
    }
    // 文書を移ったら、読み上げとキーボードの位置を文書の題へ移す（開いた直後は移さない）
    if (switched && !initial) {
      const title = view.querySelector("h1");
      title.tabIndex = -1;
      title.focus({ preventScroll: Boolean(heading) });
    }
  };

  window.addEventListener("hashchange", () => route(false));
  route(true);

  // ---------- 文書の一覧のパネル（狭い幅） ----------

  // パネルを開き、開いている文書の行へフォーカスを置く（Tab と矢印で前後の文書へ移れる）
  openButton.addEventListener("click", () => {
    panel.showModal();
    openButton.setAttribute("aria-expanded", "true");
    panel.querySelector(".mdmark-doc-list a[aria-current]").focus();
  });
  panel.addEventListener("close", () => openButton.setAttribute("aria-expanded", "false"));
  panel.querySelector("[data-panel-close]").addEventListener("click", () => panel.close());

  // パネルで文書を選んだら閉じる（移るのはリンクの # の変化に任せる）
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) panel.close();
  });

  // closedby を持たないブラウザ: 背景の押下で閉じる
  if (typeof HTMLDialogElement !== "undefined" && !("closedBy" in HTMLDialogElement.prototype)) {
    panel.addEventListener("click", (event) => {
      if (event.target !== panel) return;
      const rect = panel.getBoundingClientRect();
      const inside = rect.left <= event.clientX && event.clientX <= rect.right && rect.top <= event.clientY && event.clientY <= rect.bottom;
      if (!inside) panel.close();
    });
  }

  // 広い幅に戻ったら、横の一覧が出るのでパネルを閉じる
  window.matchMedia("(min-width: 60rem)").addEventListener("change", (event) => {
    if (event.matches && panel.open) panel.close();
  });

  // ---------- 印刷の見え方（モックだけの仕組み） ----------

  const printStyles = [...document.querySelectorAll("[data-print-styles]")];
  const previewButton = document.querySelector("[data-preview-toggle]");
  let schemeBeforePreview = "";

  // 印刷の規則を画面にも当て、紙と同じく明るい配色にする。もう一度押すと戻す
  previewButton.addEventListener("click", () => {
    const entering = printStyles[0].media !== "all";
    if (entering) {
      schemeBeforePreview = root.dataset.scheme;
      root.dataset.scheme = "light";
    } else {
      root.dataset.scheme = schemeBeforePreview;
    }
    for (const link of printStyles) link.media = entering ? "all" : "print";
    previewButton.setAttribute("aria-pressed", String(entering));
  });
}
