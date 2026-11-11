// #275 のコードブロックの見本: 行のマーカー（focus・error・warning）・インデントによる畳む・開く（Shift で入れ子もまとめて）・インデントの縦線・fold=。
// [data-mock-code275] の pre の code の中身を行に分け、行番号・マーカー・畳むボタン・縦線を付ける。
// モックだけの指定: data-marks（"行:種類" をカンマで並べる）・data-fold（fold= の行）・data-numbered（行番号を出す）。
// refs/151/assets/code-block.js（コピーのボタン）より先に読む

{
  // インデントの 1 レベルの文字数
  const INDENT = 2;
  const ICON = {
    open: '<path d="m6 9 6 6 6-6"/>',
    closed: '<path d="m9 18 6-6-6-6"/>',
  };

  const indentOf = (text) => (text.trim() === "" ? null : text.match(/^ */)[0].length);

  /** 行ごとの畳める範囲の終わり（次の行が深い行だけ。同じ深さ以下の行の手前まで。空行は範囲に含める）。 */
  const foldRanges = (texts) => {
    const indents = texts.map(indentOf);
    return texts.map((_, i) => {
      const base = indents[i];
      if (base === null) return null;
      const next = indents.slice(i + 1).findIndex((v) => v !== null);
      if (next < 0 || indents[i + 1 + next] <= base) return null;
      let end = i + 1;
      while (end + 1 < texts.length && (indents[end + 1] === null || indents[end + 1] > base)) end += 1;
      // 末尾の空行は範囲に含めない
      while (indents[end] === null) end -= 1;
      return end;
    });
  };

  for (const pre of document.querySelectorAll("[data-mock-code275]")) {
    const code = pre.querySelector("code");
    const htmlLines = code.innerHTML.split("\n");
    const texts = code.textContent.split("\n");
    const marks = new Map((pre.dataset.marks ?? "").split(",").filter(Boolean).map((m) => m.split(":")).map(([n, kind]) => [Number(n), kind]));
    const numbered = "numbered" in pre.dataset;
    const ranges = foldRanges(texts);
    const digits = String(texts.length).length;
    pre.classList.add("mdmark-code-lines", "mdmark-code-foldable");
    if (numbered) pre.classList.add("mdmark-code-numbered");
    if ([...marks.values()].some((k) => k === "error" || k === "warning")) pre.classList.add("mdmark-code-signs");
    if ([...marks.values()].includes("focus")) pre.classList.add("mdmark-code-has-focus");
    code.style.setProperty("--mdmark-code-digits", String(digits));
    code.innerHTML = htmlLines
      .map((html, i) => {
        const n = i + 1;
        const level = Math.floor((indentOf(texts[i]) ?? 0) / INDENT);
        const guides = Array.from({ length: level }, (_, k) => `<span class="mdmark-code-guide" style="--mdmark-code-guide-level:${k}" aria-hidden="true"></span>`).join("");
        const fold =
          ranges[i] === null
            ? ""
            : `<button class="mdmark-code-fold" type="button" aria-expanded="true" aria-label="${n} 行目から ${ranges[i] + 1} 行目" data-fold-line="${n}"><svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON.open}</svg></button>`;
        const kind = marks.get(n);
        return `<span class="mdmark-code-line"${numbered ? ` data-line="${n}"` : ""}${kind ? ` data-kind="${kind}"` : ""} data-level="${level}">${guides}${fold}<span class="mdmark-code-text">${html}</span></span>`;
      })
      .join("");
    const lines = [...code.querySelectorAll(".mdmark-code-line")];

    /** 開いている範囲の中で、畳んだ行の範囲に入っている行を隠す。 */
    const refresh = () => {
      const hiddenUntil = [];
      lines.forEach((line, i) => {
        const covered = hiddenUntil.some((end) => i <= end);
        line.hidden = covered;
        const button = line.querySelector(".mdmark-code-fold");
        if (button && button.getAttribute("aria-expanded") === "false" && !covered) hiddenUntil.push(ranges[i]);
      });
    };

    /** 1 つの行を畳む・開く。 */
    const setFolded = (i, folded) => {
      const button = lines[i].querySelector(".mdmark-code-fold");
      if (!button) return;
      button.setAttribute("aria-expanded", String(!folded));
      button.querySelector("svg").innerHTML = folded ? ICON.closed : ICON.open;
      lines[i].classList.toggle("is-folded", folded);
      // 畳んだ行の後ろの ⋯: 押すと展開する。展開したら削除する
      lines[i].querySelector(".mdmark-code-fold-more")?.remove();
      if (folded) {
        lines[i].insertAdjacentHTML(
          "beforeend",
          `<button class="mdmark-code-fold-more" type="button" aria-label="${i + 1} 行目から ${ranges[i] + 1} 行目を展開" data-fold-line="${i + 1}">⋯</button>`,
        );
      }
    };

    code.addEventListener("click", (event) => {
      const target = event.target.closest(".mdmark-code-fold, .mdmark-code-fold-more");
      if (!target) return;
      const i = Number(target.dataset.foldLine) - 1;
      const folded = target.classList.contains("mdmark-code-fold") && target.getAttribute("aria-expanded") === "true";
      setFolded(i, folded);
      // Shift を押しながら: 範囲の中の入れ子もまとめて畳む・開く
      if (event.shiftKey) for (let k = i + 1; k <= ranges[i]; k += 1) setFolded(k, folded);
      refresh();
    });

    // ポインターを乗せた行のブロックの縦線を濃くする: その行を含む最も内側の範囲の、範囲の深さの縦線
    code.addEventListener("pointerover", (event) => {
      const line = event.target.closest(".mdmark-code-line");
      for (const guide of code.querySelectorAll(".mdmark-code-guide.is-active")) guide.classList.remove("is-active");
      if (!line) return;
      const i = lines.indexOf(line);
      let owner = -1;
      for (let k = i - 1; k >= 0; k -= 1) {
        if (ranges[k] !== null && ranges[k] >= i) {
          owner = k;
          break;
        }
      }
      if (owner < 0) return;
      const level = Number(lines[owner].dataset.level);
      for (let k = owner + 1; k <= ranges[owner]; k += 1) lines[k].querySelectorAll(".mdmark-code-guide")[level]?.classList.add("is-active");
    });
    code.addEventListener("pointerleave", () => {
      for (const guide of code.querySelectorAll(".mdmark-code-guide.is-active")) guide.classList.remove("is-active");
    });

    // fold=: 書いた行を最初から畳む（畳んだ状態は覚えない）
    for (const n of (pre.dataset.fold ?? "").split(",").filter(Boolean)) setFolded(Number(n) - 1, true);
    refresh();
  }
}
