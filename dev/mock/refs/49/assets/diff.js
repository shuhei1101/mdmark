// 差分のモック: 文書の上に「変更を見る」を置き、取り出し元から受けた 2 つのリビジョンの Markdown を行で比べ、
// 消した行と足した行の対を語で比べて描く（実装の jsdiff の diffLines・diffWords の代わり）。
// 埋め込んだ HTML の範囲は、ソースの色分けと描いた結果の前と後を切り替える

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const DOC_ID = "guide";
  const HTML_OPEN = "<!-- html -->";
  const HTML_CLOSE = "<!-- /html -->";
  const LOADING_DELAY_MS = 1000;
  const SPINNER_DELAY_MS = 2000;
  const SVG_NS = 'xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const ICON_DIFF = `<svg ${SVG_NS}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M9 10h6"/><path d="M12 13V7"/><path d="M9 17h6"/></svg>`;
  const ICON_ARROW = `<svg ${SVG_NS}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const KIND_NAME = { del: "消した行", add: "足した行" };
  const KIND_SIGN = { del: "-", add: "+", same: " " };
  let serial = 0;

  /** HTML に埋める文字をエスケープする。 */
  const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** HTML 文字列から要素を作る。 */
  const html = (source) => {
    const template = document.createElement("template");
    template.innerHTML = source.trim();
    return template.content.firstElementChild;
  };

  /** 選ぶ欄と見出しに出すリビジョンの説明（日時・label・author）。 */
  const describe = (revision) =>
    DATE_FORMAT.format(new Date(revision.at)) + (revision.label ? ` ${revision.label}` : "") + (revision.author ? `（${revision.author}）` : "");

  /** 2 つの列の最長共通部分列から、同じ・消した・足したの並びを返す。変えた塊の中では消したを先に並べる。 */
  const diffSeq = (a, b) => {
    const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        ops.push({ kind: "same", text: a[i++] });
        j++;
      } else if (j >= b.length || (i < a.length && table[i + 1][j] >= table[i][j + 1])) {
        ops.push({ kind: "del", text: a[i++] });
      } else {
        ops.push({ kind: "add", text: b[j++] });
      }
    }
    // 変えた塊ごとに、消したを先・足したを後に並べ直す
    const sorted = [];
    let run = [];
    for (const op of [...ops, { kind: "same", end: true }]) {
      if (op.kind !== "same") {
        run.push(op);
        continue;
      }
      sorted.push(...run.filter((r) => r.kind === "del"), ...run.filter((r) => r.kind === "add"));
      run = [];
      if (!op.end) sorted.push(op);
    }
    return sorted;
  };

  /** 行を比べる単位に切る。語の区切りを持つブラウザは語で、持たないブラウザは 1 文字ずつ。 */
  const tokenize = (text, useSegmenter) =>
    useSegmenter && "Segmenter" in Intl
      ? [...new Intl.Segmenter("ja", { granularity: "word" }).segment(text)].map((s) => s.segment)
      : [...text];

  /** 消した行と足した行の対を語で比べ、変わった語を濃い色の要素で包んだ 2 つの HTML を返す。 */
  const wordDiff = (before, after, useSegmenter) => {
    const ops = diffSeq(tokenize(before, useSegmenter), tokenize(after, useSegmenter));
    const side = (keep, mark, tag) => {
      let out = "";
      let marked = "";
      const flush = () => {
        if (marked) out += `<${tag} class="mdmark-diff-word">${escape(marked)}</${tag}>`;
        marked = "";
      };
      for (const op of ops) {
        if (op.kind === mark) marked += op.text;
        else if (op.kind === keep) {
          flush();
          out += escape(op.text);
        }
      }
      flush();
      return out;
    };
    return { before: side("same", "del", "del"), after: side("same", "add", "ins") };
  };

  /** 差分の 1 行の HTML。消した・足した行は行頭の印と読み上げの名前を持つ。 */
  const lineHtml = (kind, textHtml) => {
    const name = KIND_NAME[kind] ? `<span class="mdmark-visually-hidden">${KIND_NAME[kind]}: </span>` : "";
    return `<div class="mdmark-diff-line" data-kind="${kind}"><span class="mdmark-diff-sign" aria-hidden="true">${KIND_SIGN[kind]}</span><span class="mdmark-diff-text">${name}${textHtml}</span></div>`;
  };

  /** 行の並びを描く。変えた塊の中で消した行と足した行を前から順に対にし、対の行は語で比べる。 */
  const linesHtml = (ops, useSegmenter) => {
    let out = "";
    for (let k = 0; k < ops.length; ) {
      if (ops[k].kind === "same") {
        out += lineHtml("same", escape(ops[k++].text));
        continue;
      }
      const dels = [];
      const adds = [];
      while (k < ops.length && ops[k].kind === "del") dels.push(ops[k++].text);
      while (k < ops.length && ops[k].kind === "add") adds.push(ops[k++].text);
      const pairs = dels.map((d, n) => (n < adds.length ? wordDiff(d, adds[n], useSegmenter) : null));
      dels.forEach((d, n) => { out += lineHtml("del", pairs[n] ? pairs[n].before : escape(d)); });
      adds.forEach((a, n) => { out += lineHtml("add", pairs[n] ? pairs[n].after : escape(a)); });
    }
    return out;
  };

  /** 行の並びを、埋め込んだ HTML の範囲とその外の塊に分ける。 */
  const splitBlocks = (ops) => {
    const blocks = [];
    let current = null;
    for (const op of ops) {
      const trimmed = op.text.trim();
      if (!current && trimmed === HTML_OPEN) {
        current = { type: "html", ops: [op] };
        continue;
      }
      if (current) {
        current.ops.push(op);
        if (trimmed === HTML_CLOSE) {
          blocks.push(current);
          current = null;
        }
        continue;
      }
      const last = blocks.at(-1);
      if (last?.type === "lines") last.ops.push(op);
      else blocks.push({ type: "lines", ops: [op] });
    }
    if (current) blocks.push(current);
    return blocks;
  };

  /** 範囲の HTML から、スクリプトとイベントの属性を落とす。 */
  const sanitize = (source) => {
    const template = document.createElement("template");
    template.innerHTML = source;
    for (const script of template.content.querySelectorAll("script")) script.remove();
    for (const element of template.content.querySelectorAll("*")) {
      for (const attr of [...element.attributes]) if (attr.name.startsWith("on")) element.removeAttribute(attr.name);
    }
    return template.innerHTML;
  };

  /** 描いた結果の片側（前か後）。範囲が無い側はそのことを示す。 */
  const sideHtml = (name, revision, lines) => {
    const caption = `<figcaption><span class="mdmark-diff-side-name">${name}</span> ${escape(describe(revision))}</figcaption>`;
    const inner = lines.length > 2 ? lines.slice(1, -1).join("\n") : "";
    const body = lines.length
      ? `<div class="mdmark-html">${sanitize(inner)}</div>`
      : `<p class="mdmark-diff-absent">${name}のリビジョンには、この範囲がありません</p>`;
    return `<figure class="mdmark-diff-side">${caption}${body}</figure>`;
  };

  /** 埋め込んだ HTML の範囲の塊。変えた範囲だけ、ソースと描いた結果を切り替える。 */
  const htmlBlock = (block, pair, opts) => {
    const changed = block.ops.some((op) => op.kind !== "same");
    const source = linesHtml(block.ops, opts.segmenter);
    if (!changed) return html(`<div class="mdmark-diff-html">${source}</div>`);
    const before = block.ops.filter((op) => op.kind !== "add").map((op) => op.text);
    const after = block.ops.filter((op) => op.kind !== "del").map((op) => op.text);
    const rendered = opts.htmlView === "rendered";
    const element = html(`
      <div class="mdmark-diff-html" data-changed>
        <div class="mdmark-diff-html-head">
          <span class="mdmark-diff-html-title">埋め込んだ HTML</span>
          <div class="mdmark-diff-view" role="group" aria-label="埋め込んだ HTML の見方">
            <button type="button" data-view="source" aria-pressed="${!rendered}">ソース</button>
            <button type="button" data-view="rendered" aria-pressed="${rendered}">描いた結果</button>
          </div>
        </div>
        <div data-pane="source"${rendered ? " hidden" : ""}>${source}</div>
        <div class="mdmark-diff-sides" data-pane="rendered" data-sides="${opts.sides ?? "side"}"${rendered ? "" : " hidden"}>
          ${sideHtml("前", pair.before, before)}${sideHtml("後", pair.after, after)}
        </div>
      </div>`);
    // 見方のボタン: 押した見方の中身を出し、押された状態を読み上げに伝える
    for (const button of element.querySelectorAll("[data-view]")) {
      button.addEventListener("click", () => {
        for (const other of element.querySelectorAll("[data-view]")) other.setAttribute("aria-pressed", String(other === button));
        for (const pane of element.querySelectorAll("[data-pane]")) pane.hidden = pane.dataset.pane !== button.dataset.view;
      });
    }
    return element;
  };

  /** 知らせの枠（取り出せないとき）。 */
  const notice = (title, text) =>
    html(`<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>${text}</p></div>`);

  /** 差分の場所に出す短い文（比べるリビジョンが無い・変更が無い）。 */
  const message = (text) => html(`<p class="mdmark-diff-empty">${text}</p>`);

  /** 2 つのリビジョンの差分を描き、消した行と足した行の数を返す。 */
  const renderDiff = (result, pair, texts, opts) => {
    const ops = diffSeq(texts.before.split("\n"), texts.after.split("\n"));
    const counts = { del: ops.filter((op) => op.kind === "del").length, add: ops.filter((op) => op.kind === "add").length };
    if (!counts.del && !counts.add) {
      result.replaceChildren(message("選んだ 2 つのリビジョンの本文に、変更はありません。"));
      return counts;
    }
    const lines = html('<div class="mdmark-diff-lines" role="group" aria-label="変更の行"></div>');
    for (const block of splitBlocks(ops)) {
      if (block.type === "html") lines.append(htmlBlock(block, pair, opts));
      else lines.insertAdjacentHTML("beforeend", linesHtml(block.ops, opts.segmenter));
    }
    result.replaceChildren(lines);
    return counts;
  };

  /** 前と後のリビジョンを選ぶ欄。後の欄では、前の欄で選んだリビジョンより古いものを選べない。 */
  const picker = (revisions, ids) => {
    const id = `mdmark-diff-${++serial}`;
    const options = revisions.map((r) => `<option value="${r.id}">${escape(describe(r))}</option>`).join("");
    const element = html(`
      <div class="mdmark-diff-picker">
        <div class="mdmark-diff-field">
          <label for="${id}-before">前のリビジョン</label>
          <select id="${id}-before" data-side="before">${options}</select>
        </div>
        <span class="mdmark-diff-arrow">${ICON_ARROW}</span>
        <div class="mdmark-diff-field">
          <label for="${id}-after">後のリビジョン</label>
          <select id="${id}-after" data-side="after">${options}</select>
        </div>
      </div>`);
    const before = element.querySelector('[data-side="before"]');
    const after = element.querySelector('[data-side="after"]');
    before.value = ids.before;
    after.value = ids.after;
    // 前の欄: 一番新しいリビジョンは、後に選ぶものが無いので選べない
    before.options[0].disabled = true;
    /** 後の欄の、前と同じか古い選択肢を選べなくする。後が前と同じか古くなったら、前の 1 つ新しいリビジョンに移す。 */
    const constrain = () => {
      const beforeIndex = before.selectedIndex;
      for (const option of after.options) option.disabled = option.index >= beforeIndex;
      if (after.selectedIndex >= beforeIndex) after.selectedIndex = beforeIndex - 1;
    };
    constrain();
    return { element, before, after, constrain };
  };

  /** 差分の場所を描く: リビジョンの一覧を受け、前と後の本文を受けて差分を出す。 */
  const openPanel = async (panel, source, opts = {}) => {
    const token = Symbol("open");
    panel.mockToken = token;
    const stale = () => panel.mockToken !== token;
    // 待ちが 1 秒を過ぎたら読み込み中の枠を出し、2 秒を過ぎたら回る表示を足す
    const box = html('<div class="mdmark-diff-loading"><span class="mdmark-diff-spinner" aria-hidden="true" hidden></span>変更を読み込んでいます</div>');
    const loadingTimer = setTimeout(() => {
      if (!stale()) panel.replaceChildren(box);
    }, opts.loadingDelay ?? LOADING_DELAY_MS);
    // spinnerDelay が null の見本では回る表示を出さない
    const spinnerTimer = opts.spinnerDelay === null ? undefined : setTimeout(() => {
      box.querySelector(".mdmark-diff-spinner").hidden = false;
    }, opts.spinnerDelay ?? SPINNER_DELAY_MS);
    const clearLoading = () => {
      clearTimeout(loadingTimer);
      clearTimeout(spinnerTimer);
    };
    let revisions;
    try {
      revisions = await source.revisions(DOC_ID);
    } catch {
      clearLoading();
      if (!stale()) panel.replaceChildren(notice("変更の履歴を表示できません", "リビジョンの一覧を取り出せませんでした。時間をおいて、変更を開き直してください。"));
      return;
    }
    clearLoading();
    if (stale()) return;
    if (revisions.length < 2) {
      panel.replaceChildren(message("この文書のリビジョンは 1 つだけのため、比べるリビジョンがありません。"));
      return;
    }
    const select = picker(revisions, { before: opts.before ?? revisions[1].id, after: opts.after ?? revisions[0].id });
    const summary = html('<p class="mdmark-diff-summary" role="status"></p>');
    const result = html('<div class="mdmark-diff-result"></div>');
    panel.replaceChildren(select.element, summary, result);
    const find = (id) => revisions.find((r) => r.id === id);
    /** 選んだ 2 つのリビジョンの本文を受けて差分を描き直す。 */
    const update = async () => {
      const pair = { before: find(select.before.value), after: find(select.after.value) };
      const ask = Symbol("update");
      result.mockAsk = ask;
      const settled = await Promise.allSettled([source.content(DOC_ID, pair.before.id), source.content(DOC_ID, pair.after.id)]);
      if (result.mockAsk !== ask) return;
      // 取り出せなかったリビジョンを知らせの枠で示す
      const failed = [pair.before, pair.after].filter((_, n) => settled[n].status === "rejected");
      if (failed.length) {
        summary.textContent = "";
        const names = failed.map((r) => `「${escape(describe(r))}」`).join("と");
        result.replaceChildren(notice("このリビジョンの本文を表示できません", `${names}の本文を取り出せませんでした。別のリビジョンを選んでください。`));
        return;
      }
      const counts = renderDiff(result, pair, { before: settled[0].value, after: settled[1].value }, opts);
      summary.textContent = counts.del || counts.add ? `消した行 ${counts.del}・足した行 ${counts.add}` : "";
    };
    select.before.addEventListener("change", () => { select.constrain(); update(); });
    select.after.addEventListener("change", update);
    await update();
  };

  /** 描いた文書に「変更を見る」を付ける。開くと差分を文書の代わりに（layout が stack なら文書の上に）出す。
      文書が h1 で始まるときは、題を差分の上に残し、帯と差分を h1 の後に置く。 */
  const attach = (article, source, opts = {}) => {
    const title = article.firstElementChild?.tagName === "H1" ? article.firstElementChild : null;
    const body = [...article.children].filter((element) => element !== title);
    const id = `mdmark-diff-panel-${++serial}`;
    const bar = html(`<div class="mdmark-diff-bar"><button type="button" class="mdmark-diff-toggle" aria-expanded="false" aria-controls="${id}">${ICON_DIFF}変更を見る</button></div>`);
    const panel = html(`<div class="mdmark-diff" id="${id}" data-layout="${opts.layout ?? "replace"}" hidden></div>`);
    if (title) title.after(bar, panel);
    else article.prepend(bar, panel);
    const button = bar.querySelector("button");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      if (opts.layout !== "stack") for (const element of body) element.style.display = open ? "none" : "";
      if (open) openPanel(panel, source, opts);
      else {
        panel.mockToken = null;
        panel.replaceChildren();
      }
    });
    if (opts.open) button.click();
  };

  window.mockDiff = { attach, openPanel };
}
