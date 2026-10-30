// ファイルツリー（実装の render と mount が付ける振る舞いのモック）: 言語 tree のコードブロックの罫線を読んで入れ子のツリーを描き、
// 注釈の列・拡張子ごとのアイコン・「ほかにもある」の項目・フォルダの開閉（Shift で入れ子を全部）・元の罫線のテキストのコピーを付ける。
// 描く先は [data-mock-tree] の pre で、中身を元の罫線のテキストとして読む。data-open に open= の値（"all" か階層の数。無ければルートだけ開く）を書く。
// モックだけの指定（html の data-*）: data-mock-note（注釈の見た目の案 "a" / "b"）・data-mock-toggle（開閉の印の案 "a" / "b"）・
// data-mock-clipboard（"fail" でクリップボードに書けなくする）。pre の data-mock-copy で "copied" / "failed" の知らせを出したまま見せる。
// refs/19/assets/syntax.js の後、refs/151/assets/code-block.js の前に読む（コードブロックの帯を付ける前に pre をツリーへ置き換える）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 部品のアイコンの線（24 の格子。lucide の形）
  const FILE_FRAME = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>';
  const ICON_PATHS = {
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    file: FILE_FRAME,
    "file-text": `${FILE_FRAME}<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
    "file-code": `${FILE_FRAME}<path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>`,
    "file-json": `${FILE_FRAME}<path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/>`,
    "file-image": `${FILE_FRAME}<circle cx="10" cy="12" r="2"/><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"/>`,
    "file-spreadsheet": `${FILE_FRAME}<path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>`,
    "file-archive": '<path d="M10 12v-1"/><path d="M10 18v-2"/><path d="M10 7V6"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 .274 1.01"/><circle cx="10" cy="20" r="2"/>',
    "file-terminal": `${FILE_FRAME}<path d="m8 16 2-2-2-2"/><path d="M12 18h4"/>`,
    ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    copied: '<path d="M20 6 9 17l-5-5"/>',
    failed: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  // 拡張子ごとのアイコン（対応表に無い拡張子は file）。名前そのもので決めるファイルを先に引く
  const ICON_BY_NAME = { Dockerfile: "file-terminal", Makefile: "file-terminal", LICENSE: "file-text" };
  const ICON_BY_EXTENSION = {
    "file-text": ["md", "mdx", "txt", "rst"],
    "file-code": ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "swift", "c", "h", "cpp", "cs", "php", "css", "scss", "html", "vue", "svelte"],
    "file-json": ["json", "jsonc", "yaml", "yml", "toml", "xml", "ini", "env", "lock"],
    "file-image": ["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico"],
    "file-spreadsheet": ["csv", "tsv", "xlsx"],
    "file-archive": ["zip", "gz", "tgz", "tar", "vsix"],
    "file-terminal": ["sh", "bash", "zsh", "ps1", "bat"],
  };
  const EXTENSION_ICONS = new Map(Object.entries(ICON_BY_EXTENSION).flatMap(([icon, extensions]) => extensions.map((extension) => [extension, icon])));

  // コピーのボタンの文言（状態ごと）。コードブロックのコピーと同じ
  const COPY_LABELS = { idle: "コピー", copied: "コピーしました", failed: "コピーできませんでした" };

  // コピーしたことの知らせを出しておく時間（ミリ秒）
  const COPIED_NOTICE_MS = 2000;

  // 罫線: 段の線と枝。今の罫線と tree --charset=ascii の罫線を同じ段の数え方で読む
  const INDENT_UNITS = ["│   ", "|   ", "    "];
  const BRANCHES = ["├── ", "└── ", "|-- ", "`-- "];
  const RULE_WIDTH = 4;

  // 項目が「ほかにもある」を表す名前
  const MORE_NAME = "...";

  const clipboardFails = document.documentElement.dataset.mockClipboard === "fail";

  /** アイコンの SVG を返す。 */
  const icon = (name, className = "mdmark-icon") => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  /** HTML の特別な文字を逃がす。 */
  const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

  /** 注釈の Markdown のインライン（コード・リンク・太字・badge:）を HTML にする。 */
  const renderInline = (text) =>
    escapeHtml(text)
      .replace(/`badge:([^`]+)`/g, '<span class="mdmark-badge">$1</span>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  /** 罫線の後ろの文字を、名前と注釈に分ける。区切りは前に空白がある最初の #。 */
  const splitNote = (text) => {
    const match = /\s#/.exec(text);
    if (!match) return { name: text.trim(), note: "" };
    return { name: text.slice(0, match.index).trim(), note: text.slice(match.index + 2).trim() };
  };

  /** 1 行を読み、段の深さ（ルートは 0）と罫線の後ろの文字を返す。 */
  const parseLine = (line) => {
    let depth = 0;
    let rest = line;
    while (INDENT_UNITS.some((unit) => rest.startsWith(unit))) {
      rest = rest.slice(RULE_WIDTH);
      depth += 1;
    }
    if (BRANCHES.some((branch) => rest.startsWith(branch))) return { depth: depth + 1, text: rest.slice(RULE_WIDTH) };
    return { depth: 0, text: rest };
  };

  /** 罫線のテキストを、子を持つ項目の木にする。 */
  const parseTree = (source) => {
    const top = { children: [], depth: -1 };
    const stack = [top];
    for (const line of source.split("\n").filter((text) => text.trim() !== "")) {
      const { depth, text } = parseLine(line);
      while (stack.at(-1).depth >= depth) stack.pop();
      const item = { depth, children: [], ...splitNote(text) };
      stack.at(-1).children.push(item);
      stack.push(item);
    }
    return top.children;
  };

  /** 項目の種類: フォルダ（名前が / で終わるか子を持つ）・ほかにもある・ファイル。 */
  const kindOf = (item) => {
    if (item.name === MORE_NAME) return "more";
    return item.name.endsWith("/") || item.children.length ? "folder" : "file";
  };

  /** ファイルのアイコンの名前を返す。 */
  const fileIcon = (name) => ICON_BY_NAME[name] ?? EXTENSION_ICONS.get(name.includes(".") ? name.split(".").pop().toLowerCase() : "") ?? "file";

  /** open= の値から、深さごとにフォルダを開くかを返す関数を作る（ルートは深さ 0。既定はルートだけ開く）。 */
  const openRule = (value) => {
    if (value === "all") return () => true;
    const levels = Number(value ?? 1);
    return (depth) => depth < levels;
  };

  // ツリーごとの通し番号（入れ子の ul の ID に使う）
  let treeCount = 0;

  /** 注釈の HTML: # の印（案 B だけで見せる）と、Markdown のインラインを描いた注釈。 */
  const noteHtml = (note) => (note ? `<span class="mdmark-tree-note"><span class="mdmark-tree-hash" aria-hidden="true"># </span>${renderInline(note)}</span>` : "");

  /** 項目の木から、入れ子の li の HTML を作る。 */
  const renderItems = (items, isOpen, treeId) =>
    items
      .map((item, index) => {
        const kind = kindOf(item);
        const depthStyle = ` style="--mdmark-tree-depth: ${item.depth}"`;
        const note = noteHtml(item.note);
        if (kind === "more") {
          return `<li class="mdmark-tree-more"><span class="mdmark-tree-row"${depthStyle}><span class="mdmark-tree-head"><span class="mdmark-tree-spacer"></span>${icon("ellipsis")}<span class="mdmark-tree-label mdmark-visually-hidden">ほかにもあります</span></span>${note}</span></li>`;
        }
        if (kind === "file") {
          return `<li class="mdmark-tree-file"><span class="mdmark-tree-row"${depthStyle}><span class="mdmark-tree-head"><span class="mdmark-tree-spacer"></span>${icon(fileIcon(item.name))}<span class="mdmark-tree-label">${escapeHtml(item.name)}</span></span>${note}</span></li>`;
        }
        // 子を持たないフォルダ: 開閉するものが無いので、ボタンにしない
        if (!item.children.length) {
          return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row"${depthStyle}><span class="mdmark-tree-head"><span class="mdmark-tree-spacer"></span>${icon("folder")}<span class="mdmark-tree-label">${escapeHtml(item.name)}</span></span>${note}</span></li>`;
        }
        const groupId = `${treeId}-${item.depth}-${index}`;
        const open = isOpen(item.depth);
        return `<li class="mdmark-tree-folder"><span class="mdmark-tree-row"${depthStyle}><button class="mdmark-tree-toggle mdmark-tree-head" type="button" aria-expanded="${open}" aria-controls="${groupId}">${icon("chevron", "mdmark-icon mdmark-tree-chevron")}${icon(open ? "folder-open" : "folder")}<span class="mdmark-tree-label">${escapeHtml(item.name)}</span></button>${note}</span><ul id="${groupId}"${open ? "" : ' hidden="until-found"'}>${renderItems(item.children, isOpen, `${groupId}`)}</ul></li>`;
      })
      .join("");

  /** 元の罫線のテキストから、帯（種類とコピーボタン）と入れ子のリストを持つツリーの入れ物を作る。 */
  const buildTree = (source, openValue) => {
    treeCount += 1;
    const treeId = `mdmark-tree-${treeCount}`;
    const holder = document.createElement("div");
    holder.className = "mdmark-tree";
    holder.id = treeId;
    holder.innerHTML = `<div class="mdmark-tree-bar">
      <span class="mdmark-tree-kind" aria-hidden="true">tree</span>
      <span class="mdmark-tree-meta"><button class="mdmark-tree-copy" type="button" data-state="idle"></button><span class="mdmark-visually-hidden mdmark-tree-status" role="status"></span></span>
    </div>
    <ul class="mdmark-tree-list" aria-label="ファイルツリー">${renderItems(parseTree(source), openRule(openValue), treeId)}</ul>`;
    holder.dataset.source = source;
    return holder;
  };

  // ---------- 注釈の列 ----------

  // 名前の幅を測る canvas（閉じたフォルダの中の項目も、描く前に幅が分かる）
  const measureContext = document.createElement("canvas").getContext("2d");

  /** 注釈の左端を、全ての項目の「段の字下げ + 開閉の印とアイコン + 名前」の最大にそろえる（項目の行の左端からの px を段ごとに引く）。 */
  const alignNotes = (holder) => {
    const list = holder.querySelector(".mdmark-tree-list");
    const rows = [...list.querySelectorAll(".mdmark-tree-row")];
    if (!rows.some((row) => row.querySelector(".mdmark-tree-note"))) return;
    const style = getComputedStyle(list);
    measureContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    // 1 段の字下げ: 入れ子の ul の左の余白と線と内側の余白
    const nested = list.querySelector("ul");
    const nestedStyle = nested && getComputedStyle(nested);
    const indent = nestedStyle ? parseFloat(nestedStyle.marginInlineStart) + parseFloat(nestedStyle.borderInlineStartWidth) + parseFloat(nestedStyle.paddingInlineStart) : 0;
    list.style.setProperty("--mdmark-tree-indent", `${indent}px`);
    // 開閉の印とアイコンの幅: ルートの項目（いつも見えている）の名前の左端から測る
    const firstRow = rows[0];
    const labelStart = firstRow.querySelector(".mdmark-tree-label").getBoundingClientRect().left - firstRow.getBoundingClientRect().left;
    const widest = Math.max(
      ...rows.map((row) => Number(row.style.getPropertyValue("--mdmark-tree-depth")) * indent + labelStart + measureContext.measureText(row.querySelector(".mdmark-tree-label").textContent).width),
    );
    list.style.setProperty("--mdmark-tree-note-start", `${Math.ceil(widest)}px`);
  };

  // ---------- 開閉 ----------

  /** フォルダを開く・閉じる。フォルダのアイコンを開閉に合わせる。 */
  const setFolderOpen = (toggle, open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".mdmark-icon:not(.mdmark-tree-chevron)").innerHTML = ICON_PATHS[open ? "folder-open" : "folder"];
    const group = document.getElementById(toggle.getAttribute("aria-controls"));
    if (open) group.removeAttribute("hidden");
    else group.setAttribute("hidden", "until-found");
  };

  /** 押したフォルダを開閉する。Shift を押しながらなら、入れ子のフォルダも全て同じ向きにする。 */
  const toggleFolder = (toggle, deep) => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    setFolderOpen(toggle, open);
    if (!deep) return;
    const group = document.getElementById(toggle.getAttribute("aria-controls"));
    for (const inner of group.querySelectorAll(".mdmark-tree-toggle")) setFolderOpen(inner, open);
  };

  // ページ内検索で閉じたフォルダの中の名前が見つかったとき: ブラウザが開く前に、開閉のボタンとアイコンを合わせる
  document.addEventListener("beforematch", (event) => {
    const group = event.target.closest(".mdmark-tree-list ul");
    const toggle = group && document.querySelector(`[aria-controls="${group.id}"]`);
    if (toggle) setFolderOpen(toggle, true);
  });

  // ---------- コピー ----------

  /** コピーのボタンに状態の文言とアイコンを当て、読み上げの知らせを入れる。 */
  const setCopyState = (holder, state, announce) => {
    const button = holder.querySelector(".mdmark-tree-copy");
    button.dataset.state = state;
    button.innerHTML = `${icon(state === "idle" ? "copy" : state)}${COPY_LABELS[state]}`;
    if (announce !== undefined) holder.querySelector(".mdmark-tree-status").textContent = announce;
  };

  /** コピーできないときのパネルを閉じ、コピーのボタンへフォーカスを戻す。 */
  const closeCopyPanel = (holder) => {
    holder.querySelector(".mdmark-copy-panel")?.remove();
    holder.querySelector(".mdmark-tree-copy").focus();
  };

  /** コピーできないときのパネル: 元の罫線のテキストを選択した状態で、ツリーの下に出す（表のコピーと同じ）。 */
  const openCopyPanel = (holder, focus) => {
    holder.querySelector(".mdmark-copy-panel")?.remove();
    const id = `${holder.id}-copy-panel`;
    const panel = document.createElement("div");
    panel.className = "mdmark-copy-panel";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-labelledby", `${id}-title`);
    panel.innerHTML = `<div class="mdmark-copy-panel-head">
      <p class="mdmark-copy-panel-title" id="${id}-title">${icon("failed")}クリップボードにコピーできませんでした</p>
      <button class="mdmark-copy-panel-close" type="button" aria-label="閉じる" title="閉じる">${icon("close")}</button>
    </div>
    <p class="mdmark-copy-panel-note">ツリーのテキストを選択しています。Ctrl+C（Mac は ⌘C）でコピーしてください。</p>
    <textarea class="mdmark-copy-panel-text" readonly rows="6" aria-labelledby="${id}-title" spellcheck="false"></textarea>`;
    const area = panel.querySelector("textarea");
    area.value = holder.dataset.source;
    panel.querySelector(".mdmark-copy-panel-close").addEventListener("click", () => closeCopyPanel(holder));
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCopyPanel(holder);
    });
    holder.append(panel);
    if (!focus) return;
    area.focus({ preventScroll: true });
    area.select();
  };

  /** 元の罫線のテキストをクリップボードへ書き、書けたらボタンで知らせ、書けなければパネルを出す。 */
  const copyTree = async (holder) => {
    holder.querySelector(".mdmark-copy-panel")?.remove();
    try {
      if (clipboardFails || !navigator.clipboard) throw new Error("クリップボードに書けない");
      await navigator.clipboard.writeText(holder.dataset.source);
    } catch {
      setCopyState(holder, "idle", "クリップボードにコピーできませんでした。選択したツリーのテキストを手でコピーできます");
      openCopyPanel(holder, true);
      return;
    }
    setCopyState(holder, "copied", "ツリーのテキストをコピーしました");
    setTimeout(() => {
      if (holder.querySelector(".mdmark-tree-copy").dataset.state === "copied") setCopyState(holder, "idle", "");
    }, COPIED_NOTICE_MS);
  };

  // ---------- 組み立て ----------

  const trees = [];
  for (const pre of document.querySelectorAll("pre[data-mock-tree]")) {
    // 元の罫線のテキスト: 先頭と末尾の改行を落とす
    const holder = buildTree(pre.textContent.replace(/^\n+|\n+$/g, ""), pre.dataset.open);
    pre.replaceWith(holder);
    setCopyState(holder, "idle");
    holder.querySelector(".mdmark-tree-copy").addEventListener("click", () => copyTree(holder));
    holder.querySelector(".mdmark-tree-list").addEventListener("click", (event) => {
      const toggle = event.target.closest(".mdmark-tree-toggle");
      if (toggle) toggleFolder(toggle, event.shiftKey);
    });
    if (pre.dataset.mockCopy === "copied") setCopyState(holder, "copied");
    if (pre.dataset.mockCopy === "failed") openCopyPanel(holder, false);
    trees.push(holder);
  }
  // 書体を読み終えてから注釈の列の位置を測る。描く先の幅が変わったら測り直す
  document.fonts.ready.then(() => trees.forEach(alignNotes));
  window.addEventListener("resize", () => trees.forEach(alignNotes));

  // ---------- 印刷の前後 ----------

  // 印刷の前に閉じていたフォルダ（印刷の後に閉じ直す）
  let closedBeforePrint = [];

  /** 閉じたフォルダを全て開き、開いた分を覚える。 */
  const expandTrees = () => {
    closedBeforePrint = [...document.querySelectorAll('.mdmark-tree-toggle[aria-expanded="false"]')];
    for (const toggle of closedBeforePrint) setFolderOpen(toggle, true);
  };

  /** 開いた分を閉じ直す。 */
  const restoreTrees = () => {
    for (const toggle of closedBeforePrint) setFolderOpen(toggle, false);
    closedBeforePrint = [];
  };

  // 印刷の前後の展開（syntax.js の window.mdmarkMockPrint）に、フォルダの展開を加える。preview.js が DOMContentLoaded で読む前に差し替える
  const { expand, restore } = window.mdmarkMockPrint;
  window.mdmarkMockPrint = {
    expand: () => {
      expand();
      expandTrees();
    },
    restore: () => {
      restore();
      restoreTrees();
    },
  };
}
