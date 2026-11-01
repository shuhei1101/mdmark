import { escapeHtml } from "../../escape.ts";

/** 再生できなかった要素ごとのタイトル */
const TITLES: Readonly<Record<"video" | "audio", string>> = {
  video: "この動画をプレビューで再生できません",
  audio: "この音声をプレビューで再生できません",
};

/** 再生できない動画・音声の知らせの枠の HTML を返す。「既定のアプリで開く」は `data-action="openAsset"` と `data-path` を持つ */
export function renderMediaError(options: {
  /** 再生できなかった要素 */
  kind: "video" | "audio";
  /** 拡張子 */
  format: string;
  /** 文書に書いたパス */
  path: string;
}): string {
  const format = escapeHtml(options.format);
  const path = escapeHtml(options.path);
  return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${TITLES[options.kind]}</strong><p>VS Code のプレビューは <code>${format}</code> の形式を再生できません。<a href="#" data-action="openAsset" data-path="${path}">既定のアプリで開く</a>（<code>${path}</code>）</p></div>`;
}
