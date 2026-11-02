// 余白のマーカーのモック（実装ではコメントを付ける関数が付ける振る舞い）: 本文の列の右に余白の列を置き、
// コメントの箇所（.mdmark-comment-mark）の行の高さにマーカーを置く。押すと箇所までスクロールして吹き出しを開く。
// 箇所の付け直し・開閉・タブの切り替え（描く先の要素の中の変化）と、描く先の要素の大きさの変化で置き直す

/** コメントのアイコン（24 の格子。lucide の message-square の形） */
const ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>';

/** 同じ行とみなす、行の上端の差の上限（px） */
const SAME_LINE_PX = 4;

/** 閉じた中の箇所を開くとき、開く処理を繰り返す上限（入れ子の閉じた中を外側から開く） */
const MAX_OPEN_DEPTH = 4;

/** 閉じた中の種類ごとの、名前に添える文言 */
const CLOSED_LABELS = {
  section: "閉じたセクションの中",
  tab: "選ばれていないタブの中",
  row: "閉じた行の詳細の中",
};

/** 箇所を包む閉じた要素のうち、いちばん外側のものを返す（閉じていなければ null） */
function outermostHidden(mark, root) {
  let found = null;
  for (let el = mark.parentElement; el && el !== root; el = el.parentElement) {
    if (el.hidden) found = el;
  }
  return found;
}

/** 閉じた要素の種類を返す */
function closedKind(hidden) {
  if (hidden.matches('[role="tabpanel"]')) return "tab";
  if (hidden.matches(".mdmark-row-detail")) return "row";
  return "section";
}

/** 閉じた要素を開くボタン（セクションの見出し・タブ・行の詳細の開閉）を返す */
function openerOf(hidden, root) {
  return hidden.id ? root.querySelector(`[aria-controls="${CSS.escape(hidden.id)}"]`) : null;
}

/** 描く先の要素に余白のマーカーを付ける。same: 同じ行の箇所の出し方（merge・row）、closed: 閉じた中の箇所の扱い（opener・none） */
export function attachMarginMarkers(root, { same, closed }) {
  const margin = document.createElement("div");
  margin.className = "mdmark-comment-margin";
  let frame = 0;

  /** 箇所ごとに、マーカーを置く基準の要素と閉じた中の種類を求める（置けない箇所は除く） */
  const collectAnchors = () =>
    [...root.querySelectorAll(".mdmark-comment-mark")].flatMap((mark) => {
      const hidden = outermostHidden(mark, root);
      if (!hidden) return [{ mark, target: mark, kind: null }];
      // 閉じた中の箇所: 案 A は開くボタンの行に置き、案 B は置かない
      const opener = closed === "opener" ? openerOf(hidden, root) : null;
      return opener ? [{ mark, target: opener, kind: closedKind(hidden) }] : [];
    });

  /** 箇所の行の上端・高さを、余白の列の上端からの位置で返す */
  const lineOf = (target, base) => {
    const rect = target.getClientRects()[0] ?? target.getBoundingClientRect();
    return { top: rect.top - base, height: rect.height };
  };

  /** マーカーを押したとき: 閉じた中を開き、箇所までスクロールして吹き出しを開く */
  const jump = (mark) => {
    for (let depth = 0; depth < MAX_OPEN_DEPTH; depth += 1) {
      const hidden = outermostHidden(mark, root);
      if (!hidden) break;
      openerOf(hidden, root)?.click();
    }
    mark.scrollIntoView({ block: "center" });
    mark.click();
  };

  /** マーカーを作る。index: 同じ行で横に並べるときの何番目か */
  const createMarker = (group, { top, height }, index) => {
    const [first] = group;
    const quote = first.mark.textContent;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mdmark-comment-marker";
    const count = group.length > 1 ? `${group.length} 件、` : "";
    const where = first.kind ? `（${CLOSED_LABELS[first.kind]}）` : "";
    button.setAttribute("aria-label", `コメント ${count}「${quote}」${where}`);
    button.title = button.getAttribute("aria-label");
    button.innerHTML = group.length > 1 ? `${ICON}<span>${group.length}</span>` : ICON;
    if (first.kind) button.dataset.closed = first.kind;
    if (group.some(({ mark }) => mark.getAttribute("aria-expanded") === "true")) button.dataset.current = "";
    button.style.top = `${top + height / 2}px`;
    button.style.setProperty("--mdmark-comment-marker-index", String(index));
    button.addEventListener("click", () => jump(first.mark));
    return button;
  };

  /** 今の箇所の位置で、マーカーを全て置き直す */
  const place = () => {
    frame = 0;
    const content = root.querySelector(":scope > .mdmark-content");
    if (!content) return;
    if (margin.previousElementSibling !== content) content.after(margin);
    const base = margin.getBoundingClientRect().top;
    // 行の上端が近い箇所を、上から順に 1 つのまとまりにする
    const lines = [];
    for (const anchor of collectAnchors()) {
      const line = lineOf(anchor.target, base);
      const last = lines.at(-1);
      if (last && Math.abs(last.line.top - line.top) <= SAME_LINE_PX) last.group.push(anchor);
      else lines.push({ line, group: [anchor] });
    }
    lines.sort((a, b) => a.line.top - b.line.top);
    const markers = lines.flatMap(({ line, group }) =>
      same === "merge"
        ? [createMarker(group, line, 0)]
        : group.map((anchor, index) => createMarker([anchor], line, index)),
    );
    margin.replaceChildren(...markers);
  };

  /** 置き直しを 1 フレームに 1 回にまとめる */
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };

  // 描く先の要素の中の変化（余白の列の中の変化を除く）と、大きさの変化で置き直す
  new MutationObserver((records) => {
    if (records.some(({ target }) => !margin.contains(target))) schedule();
  }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "aria-expanded", "class"] });
  new ResizeObserver(schedule).observe(root);
  schedule();
}
