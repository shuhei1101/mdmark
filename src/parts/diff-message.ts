/** 種類ごとの文 */
const MESSAGES = {
  same: "選んだ 2 つのリビジョンの本文に、変更はありません。",
  single:
    "この文書のリビジョンは 1 つだけのため、比較対象のリビジョンがありません。",
  loading: "変更を読み込んでいます",
};

/** 部品設計『差分の状態の文』: 差分の場所に、行の代わりに出す短い文（変更が無い・比較対象が無い・読み込んでいる）の HTML を返す。`loading` は読み上げの対象にしない */
export function renderDiffMessage(options: {
  /** 出す文 */
  kind: "same" | "single" | "loading";
  /** 回る表示を足すか（`loading` のとき。待ちが 2 秒を過ぎたとき） */
  spinner?: boolean;
}): string {
  const { kind, spinner = false } = options;
  if (kind !== "loading") {
    return `<p class="mdmark-diff-empty">${MESSAGES[kind]}</p>`;
  }
  const mark = spinner
    ? '<span class="mdmark-diff-spinner" aria-hidden="true"></span>'
    : "";
  return `<div class="mdmark-diff-loading">${mark}${MESSAGES.loading}</div>`;
}
