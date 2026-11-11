// コマンドのエイリアスのツールチップのコピーのボタン（実装の mount が付ける振る舞いのモック）。
// 押すとツールチップのコマンドをクリップボードへ書き、書けたか・書けなかったかをボタンの文言とアイコンで示し、読み上げにも知らせる。
// 開閉と置き場所は refs/27/assets/glossary.js が受け持つ。
// モックだけの指定: ボタンの data-mock-copy（"copied" / "failed" の知らせを出したまま見せる）

// sample.js・glossary.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // コピーのボタンのアイコン（24 の格子。lucide の形。コードブロックのコピーのボタンと同じ）
  const ICON_PATHS = {
    idle: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    copied: '<path d="M20 6 9 17l-5-5"/>',
    failed: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  };

  // コピーのボタンの文言（状態ごと）
  const COPY_LABELS = { idle: "コピー", copied: "コピーしました", failed: "コピーできませんでした" };

  // コピーしたことの知らせを出しておく時間（ミリ秒）。できなかったことの知らせは次に押すまで残す
  const COPIED_NOTICE_MS = 2000;

  /** コピーのボタンに状態の文言とアイコンを当て、読み上げにも知らせる。 */
  const setState = (button, state) => {
    button.dataset.state = state;
    button.innerHTML = `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[state]}</svg>${COPY_LABELS[state]}`;
    const status = button.closest(".mdmark-term-tip").querySelector(".mdmark-term-tip-status");
    status.textContent = state === "idle" ? "" : `コマンドを${COPY_LABELS[state]}`;
  };

  /** ツールチップのコマンドをクリップボードへ書く。 */
  const copyCommand = async (button) => {
    const command = button.closest(".mdmark-term-tip-command").querySelector("code").textContent;
    try {
      if (!navigator.clipboard) throw new Error("クリップボードに書けない");
      await navigator.clipboard.writeText(command);
    } catch {
      setState(button, "failed");
      return;
    }
    setState(button, "copied");
    setTimeout(() => {
      if (button.dataset.state === "copied") setState(button, "idle");
    }, COPIED_NOTICE_MS);
  };

  for (const button of document.querySelectorAll(".mdmark-term-tip-copy")) {
    button.addEventListener("click", () => copyCommand(button));
    if (button.dataset.mockCopy) setState(button, button.dataset.mockCopy);
  }
}
