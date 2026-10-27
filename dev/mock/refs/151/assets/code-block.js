// コードブロックの言語のラベルとコピーボタン（実装の mount が付ける振る舞いのモック）。
// 描いた文書の直下のコードブロック（pre）に、題の帯（題があれば題・言語のラベル・コピーボタン）を付ける。
// 言語は code の class（language-*）を情報文字列の最初の語として読む。埋め込んだ HTML・図の中の pre には付けない。
// モックだけの指定: html の data-mock-clipboard="fail"（クリップボードに書けなくする）、
// コードブロックの data-mock-copy（"copied" / "failed" の知らせを出したまま見せる）・data-mock-placement（"overlay" でコードの右上に重ねる案）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // コピーのボタンのアイコン（24 の格子。lucide の形）
  const ICON_PATHS = {
    idle: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    copied: '<path d="M20 6 9 17l-5-5"/>',
    failed: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  };

  // コピーのボタンの文言（状態ごと）
  const COPY_LABELS = { idle: "コピー", copied: "コピーしました", failed: "コピーできませんでした" };

  // コピーしたことの知らせを出しておく時間（ミリ秒）。できなかったことの知らせは次に押すまで残す
  const COPIED_NOTICE_MS = 2000;

  const clipboardFails = document.documentElement.dataset.mockClipboard === "fail";

  /** コピーのボタンに状態の文言とアイコンを当て、読み上げにも知らせる。 */
  const setState = (block, state) => {
    const button = block.querySelector(".mdmark-code-copy");
    button.dataset.state = state;
    button.innerHTML = `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[state]}</svg>${COPY_LABELS[state]}`;
    block.querySelector(".mdmark-code-status").textContent = state === "idle" ? "" : `コードを${COPY_LABELS[state]}`;
  };

  /** コピーする文字: 削除した行を除いた変更後のコード（行のマーカーは描くときに外してある）。 */
  const codeText = (pre) => {
    const lines = pre.querySelectorAll(".mdmark-code-line");
    if (!lines.length) return pre.querySelector("code").textContent;
    return [...lines]
      .filter((line) => line.dataset.kind !== "del")
      .map((line) => line.querySelector(".mdmark-code-text").textContent)
      .join("\n");
  };

  /** コードをクリップボードへ書き、書けたか・書けなかったかをボタンの文言で知らせる。 */
  const copyCode = async (block, pre) => {
    try {
      if (clipboardFails || !navigator.clipboard) throw new Error("クリップボードに書けない");
      await navigator.clipboard.writeText(codeText(pre));
    } catch {
      setState(block, "failed");
      return;
    }
    setState(block, "copied");
    setTimeout(() => {
      if (block.querySelector(".mdmark-code-copy").dataset.state === "copied") setState(block, "idle");
    }, COPIED_NOTICE_MS);
  };

  for (const pre of document.querySelectorAll(".mdmark pre")) {
    // 埋め込んだ HTML・図・差分の中の pre には付けない
    if (pre.closest(".mdmark-embed, .mdmark-diagram, .mdmark-diff")) continue;
    const language = [...pre.querySelector("code")?.classList ?? []].find((name) => name.startsWith("language-"))?.slice("language-".length);
    // 題の帯: 題を持つコードブロックは題の行を帯にし、持たないコードブロックは帯を作ってコードブロックを囲む
    let block = pre.closest(".mdmark-code");
    let bar = block?.querySelector(".mdmark-code-title");
    if (!bar) {
      const holder = document.createElement("div");
      holder.className = "mdmark-code";
      if (pre.dataset.mockCopy) holder.dataset.mockCopy = pre.dataset.mockCopy;
      if (pre.dataset.mockPlacement) holder.dataset.mockPlacement = pre.dataset.mockPlacement;
      pre.before(holder);
      bar = document.createElement("div");
      bar.className = "mdmark-code-title";
      holder.append(bar, pre);
      block = holder;
    }
    bar.classList.add("mdmark-code-bar");
    const meta = document.createElement("span");
    meta.className = "mdmark-code-meta";
    // 言語のラベル: 情報文字列の最初の語をそのまま出す。読み上げは pre の名前が持つので重ねず、選んだ文字にも入れない
    meta.innerHTML = `${language ? `<span class="mdmark-code-lang" aria-hidden="true">${language}</span>` : ""}<button class="mdmark-code-copy" type="button" data-state="idle"></button><span class="mdmark-visually-hidden mdmark-code-status" role="status"></span>`;
    bar.append(meta);
    setState(block, "idle");
    meta.querySelector(".mdmark-code-copy").addEventListener("click", () => copyCode(block, pre));
    if (block.dataset.mockCopy) setState(block, block.dataset.mockCopy);
  }
}
