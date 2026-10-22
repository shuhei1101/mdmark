// コメントのモック（実装の mount とコメントを付ける関数が付ける振る舞い）: 文字を選ぶとコメントのボタンを出し、入力欄で書いて保存すると箇所に印を付け、
// 印から吹き出しを開く。保存先は持たず、保存したことにして印を付ける。
// [data-mock-comments] の値で場面を変える: on（保存できる）・save-error（保存で失敗する）。属性の無い要素の中ではボタンを出さない。
// 保存したコメントの印は .mdmark-comment-mark[data-mock-body] で置く

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 操作のアイコン（24 の格子。lucide の形）
  const ICONS = {
    add: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 8v6"/><path d="M9 11h6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  };

  // 保存にかかる時間（モックの仮の待ち。保存している間の表示を見せる）
  const SAVE_DELAY_MS = 700;
  // 箇所と枠の間の隙間と、画面の端から離す幅
  const GAP_PX = 6;
  const GUTTER_PX = 8;
  // 入力欄を開いている間の選んだ箇所の色の名前（CSS の ::highlight() と揃える）
  const PENDING_HIGHLIGHT = "mdmark-comment-pending";

  /** アイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // 印の読み上げの説明（全ての印で共有する）
  const hint = document.createElement("span");
  hint.id = "mdmark-comment-hint";
  hint.hidden = true;
  hint.textContent = "コメントが付いた箇所";
  document.body.append(hint);

  // 印 → 付いたコメントの本文の並び
  const bodies = new Map();
  // 開いている入力欄か吹き出しと、その位置の元（選んだ範囲か印）
  let open = null;

  /** 枠を元の箇所の下に置く。下に収まらなければ上に置き、左右は画面の中に収める。 */
  const place = (element, rect) => {
    const left = Math.min(Math.max(rect.left, GUTTER_PX), window.innerWidth - element.offsetWidth - GUTTER_PX);
    const below = rect.bottom + GAP_PX;
    const top =
      below + element.offsetHeight > window.innerHeight - GUTTER_PX ? Math.max(GUTTER_PX, rect.top - element.offsetHeight - GAP_PX) : below;
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  };

  // ---------- コメントのボタン ----------

  const addButton = document.createElement("button");
  addButton.className = "mdmark-comment-add";
  addButton.type = "button";
  addButton.hidden = true;
  addButton.innerHTML = `${icon("add")}コメント`;
  let pendingRange = null;

  /** 選んだ範囲が、コメントを付けられる要素の中の文字かを返す（付けられる要素を返す）。 */
  const scopeOf = (range) => {
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    // 入力欄・ビューの操作・既にある印の中の選びには出さない
    if (element.closest("input, textarea, .mdmark-view-bar, .mdmark-comment-mark, .mdmark-comment-popover")) return null;
    return element.closest('[data-mock-comments="on"], [data-mock-comments="save-error"]');
  };

  /** 選びに合わせてボタンを出し入れする。ボタンは選んだ文字の後ろのブロックの直後に置き、Tab で届くようにする。 */
  const syncAddButton = () => {
    if (open) return;
    const selection = document.getSelection();
    const range = selection.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0) : null;
    const scope = range && range.toString().trim() ? scopeOf(range) : null;
    if (!scope) {
      if (document.activeElement !== addButton) addButton.hidden = true;
      return;
    }
    pendingRange = range.cloneRange();
    const end = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
    const block = end.closest("p, li, td, th, h1, h2, h3, blockquote") ?? scope;
    (scope.contains(block) && block !== scope ? block : scope.lastElementChild ?? scope).after(addButton);
    addButton.hidden = false;
    // 選んだ文字の終わりの下に置く。下に収まらなければ上に置く
    const rect = range.getBoundingClientRect();
    const below = rect.bottom + GAP_PX;
    addButton.style.left = `${Math.min(Math.max(rect.right - addButton.offsetWidth, GUTTER_PX), window.innerWidth - addButton.offsetWidth - GUTTER_PX)}px`;
    addButton.style.top = `${below + addButton.offsetHeight > window.innerHeight - GUTTER_PX ? rect.top - addButton.offsetHeight - GAP_PX : below}px`;
  };

  document.addEventListener("selectionchange", () => requestAnimationFrame(syncAddButton));

  // ---------- 入力欄 ----------

  /** 入力欄を閉じる。書いた文字があるときは捨ててよいかを確かめる。閉じたら真を返す。 */
  const closeForm = (force) => {
    const textarea = open.element.querySelector("textarea");
    if (!force && textarea.value.trim() && !window.confirm("書いたコメントを捨てて閉じますか？")) return false;
    open.element.remove();
    open = null;
    CSS.highlights.delete(PENDING_HIGHLIGHT);
    return true;
  };

  /** 選んだ範囲を印で包み、コメントの本文を印に結ぶ。 */
  const markRange = (range, body) => {
    const mark = document.createElement("mark");
    mark.className = "mdmark-comment-mark";
    mark.append(range.extractContents());
    range.insertNode(mark);
    setupMark(mark, [body]);
    return mark;
  };

  /** 選んだ範囲の下に入力欄を開く。 */
  const openForm = (range) => {
    const scope = scopeOf(range);
    const dialog = document.createElement("div");
    dialog.className = "mdmark-comment-popover mdmark-comment-form";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "コメントを書く");
    dialog.innerHTML = `<form novalidate><p class="mdmark-comment-quote"></p>
<label class="mdmark-comment-field">コメント<textarea name="body" rows="3" aria-describedby="mdmark-comment-error"></textarea></label>
<p class="mdmark-comment-error" id="mdmark-comment-error" role="alert" hidden>${icon("alert")}<span></span></p>
<div class="mdmark-comment-actions">
  <button class="mdmark-comment-button" type="button" data-action="cancel">キャンセル</button>
  <button class="mdmark-comment-button is-primary" type="submit">コメントを保存</button>
</div></form>`;
    // 選んだ文字は文字として入れ、HTML として読まない
    dialog.querySelector(".mdmark-comment-quote").textContent = `「${range.toString().trim()}」へのコメント`;
    document.body.append(dialog);
    open = { element: dialog, anchor: () => range.getBoundingClientRect(), returnTo: addButton };
    place(dialog, range.getBoundingClientRect());
    addButton.hidden = true;
    // 選びが入力欄へ移って消えても、選んだ箇所に色を残す
    CSS.highlights.set(PENDING_HIGHLIGHT, new Highlight(range));

    const form = dialog.querySelector("form");

    const textarea = form.querySelector("textarea");
    const error = form.querySelector(".mdmark-comment-error");
    const submit = form.querySelector('[type="submit"]');
    textarea.focus();

    /** 入力欄のそばに知らせを出す。 */
    const showError = (message) => {
      error.querySelector("span").textContent = message;
      error.hidden = false;
      textarea.setAttribute("aria-invalid", "true");
      place(dialog, range.getBoundingClientRect());
    };

    form.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      if (closeForm(false)) addButton.hidden = true;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body) {
        showError("コメントを書いてから保存してください。");
        textarea.focus();
        return;
      }
      // 保存している間: 二重に押せないようにし、保存していることを見せる
      submit.disabled = true;
      submit.textContent = "保存しています…";
      dialog.setAttribute("aria-busy", "true");
      setTimeout(() => {
        submit.disabled = false;
        submit.textContent = "コメントを保存";
        dialog.removeAttribute("aria-busy");
        if (scope.dataset.mockComments === "save-error") {
          // 保存できない: 入力欄を閉じず、書いた本文を残して知らせる。理由は使う側が調べられるよう console に出す
          console.error("[mdmark] コメントを保存できませんでした", new Error("保存の関数が失敗を返しました（モック）"));
          showError("コメントを保存できませんでした。書いたコメントは残っています。もう一度「コメントを保存」を押してください。");
          textarea.focus();
          return;
        }
        closeForm(true);
        document.getSelection().removeAllRanges();
        markRange(range, body).focus();
      }, SAVE_DELAY_MS);
    });
  };

  addButton.addEventListener("click", () => {
    if (pendingRange) openForm(pendingRange);
  });

  // ---------- 印と吹き出し ----------

  /** 印の吹き出しを閉じる。 */
  const closeBubble = (returnFocus) => {
    const { element, returnTo } = open;
    element.remove();
    returnTo.setAttribute("aria-expanded", "false");
    open = null;
    if (returnFocus) returnTo.focus();
  };

  /** 印の下に、付いたコメントの吹き出しを開く。 */
  const openBubble = (mark) => {
    if (open) open.element.matches(".mdmark-comment-form") ? closeForm(false) : closeBubble(false);
    if (open) return;
    const bubble = document.createElement("div");
    bubble.className = "mdmark-comment-popover mdmark-comment-bubble";
    bubble.setAttribute("role", "dialog");
    bubble.setAttribute("aria-label", "コメント");
    bubble.tabIndex = -1;
    bubble.innerHTML = `<div class="mdmark-comment-head"><p class="mdmark-comment-quote"></p><button class="mdmark-comment-close" type="button" aria-label="閉じる" title="閉じる">${icon("close")}</button></div>
<ul class="mdmark-comment-list"></ul>`;
    bubble.querySelector(".mdmark-comment-quote").textContent = `「${mark.textContent}」へのコメント`;
    // コメントの本文は文字として入れ、HTML として読まない
    for (const body of bodies.get(mark)) {
      const item = document.createElement("li");
      const text = document.createElement("p");
      text.className = "mdmark-comment-body";
      text.textContent = body;
      item.append(text);
      bubble.querySelector(".mdmark-comment-list").append(item);
    }
    document.body.append(bubble);
    open = { element: bubble, anchor: () => mark.getBoundingClientRect(), returnTo: mark };
    mark.setAttribute("aria-expanded", "true");
    place(bubble, mark.getBoundingClientRect());
    bubble.querySelector(".mdmark-comment-close").addEventListener("click", () => closeBubble(true));
    bubble.focus();
  };

  /** 印を押せるようにし、付いたコメントを結ぶ。 */
  const setupMark = (mark, list) => {
    bodies.set(mark, list);
    mark.tabIndex = 0;
    mark.setAttribute("role", "button");
    mark.setAttribute("aria-haspopup", "dialog");
    mark.setAttribute("aria-expanded", "false");
    mark.setAttribute("aria-describedby", hint.id);
    mark.addEventListener("click", () => openBubble(mark));
    mark.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openBubble(mark);
    });
  };

  for (const mark of document.querySelectorAll(".mdmark-comment-mark[data-mock-body]")) {
    setupMark(mark, mark.dataset.mockBody.split("\n---\n"));
  }

  // ---------- 閉じ方と位置の追従 ----------

  // Esc: 開いている入力欄か吹き出しを閉じ、開いた元へフォーカスを戻す
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !open) return;
    if (open.element.matches(".mdmark-comment-form")) {
      const returnTo = open.returnTo;
      if (closeForm(false) && document.contains(returnTo) && !returnTo.hidden) returnTo.focus();
    } else {
      closeBubble(true);
    }
  });

  // 外側を押す: 吹き出しだけを閉じる（入力欄は書いた文字を失わないよう、キャンセルか Esc で閉じる）
  document.addEventListener("pointerdown", (event) => {
    if (!open || !open.element.matches(".mdmark-comment-bubble")) return;
    if (open.element.contains(event.target) || open.returnTo.contains(event.target)) return;
    closeBubble(false);
  });

  // スクロールと幅の変化: 開いている枠を元の箇所に付いていかせる
  const follow = () => {
    if (open) place(open.element, open.anchor());
    else syncAddButton();
  };
  document.addEventListener("scroll", follow, true);
  window.addEventListener("resize", follow);
}
