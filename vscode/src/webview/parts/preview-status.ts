import { escapeHtml } from "../../escape.ts";

/** 出す状態 */
export type PreviewStatusState =
  | "loading"
  | "offline"
  | "versionMissing"
  | "versionUndecidable"
  | "diffUnsupported";

/** 「リロード」のボタン */
const RELOAD_BUTTON =
  '<button class="mdmark-preview-button" type="button" data-action="reload">リロード</button>';

/** 描けない理由の本文。`version` は読もうとしたバージョン（エスケープ済み） */
function reasonOf(
  state: Exclude<PreviewStatusState, "loading">,
  version: string,
) {
  if (state === "offline") {
    return `mdmark（<code>${version}</code>）を jsDelivr から読み込めませんでした。ネットワークにつながっているかを確かめてから、リロードしてください。`;
  }
  if (state === "diffUnsupported") {
    return `読み込んだ mdmark（<code>${version}</code>）は差分の表示に対応していません。設定 <code>mdmark.version</code> を差分の表示に対応したバージョンか <code>latest</code> に変更してから、リロードしてください。`;
  }
  if (state === "versionMissing") {
    return `設定 <code>mdmark.version</code> に指定したバージョン <code>${version}</code> の mdmark が見つかりませんでした。存在するバージョンか <code>latest</code> に直してから、リロードしてください。`;
  }
  return "読む mdmark のバージョンを決められませんでした。GitHub から最新のバージョンを取得できず、前回のバージョンも残っていません。ネットワークにつながっているかを確かめてから、リロードしてください。";
}

/** 読み込み中か、描けない理由と「リロード」の HTML を返す。`version` はエスケープする */
export function renderPreviewStatus(options: {
  /** 出す状態 */
  state: PreviewStatusState;
  /** 読もうとした mdmark のバージョン（`offline`・`versionMissing` の理由に入れる） */
  version?: string;
}): string {
  const { state } = options;
  if (state === "loading") {
    return '<div class="mdmark-preview-status"><div class="mdmark-preview-loading" role="status"><progress class="mdmark-preview-spinner" aria-label="読み込み中"></progress><h1>mdmark を読み込んでいます</h1></div></div>';
  }
  const version = escapeHtml(options.version ?? "");
  return `<div class="mdmark-preview-status"><div class="mdmark-preview-notice" role="status"><h1>プレビューを表示できません</h1><p>${reasonOf(state, version)}</p>${RELOAD_BUTTON}</div></div>`;
}
