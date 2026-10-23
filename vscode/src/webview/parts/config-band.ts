import { escapeHtml } from "../../escape.ts";

/** 設定ファイルを読めない帯と「設定ファイルを開く」の HTML を返す。`path` はエスケープする */
export function renderConfigBand(options: {
  /** 設定ファイルのパス（`mdmark.configPath` の記載したまま） */
  path: string;
  /** 読めない行（1 始まり） */
  line: number;
}): string {
  const path = escapeHtml(options.path);
  return `<div class="mdmark-config-band" role="status"><div class="mdmark-config-band-text"><h2>設定ファイルを読み込めません</h2><p><code>${path}</code> の ${options.line} 行目を YAML として読めないため、<code>features</code> と <code>libraries</code> を当てずに表示しています。</p></div><button class="mdmark-preview-button" type="button" data-action="openConfig">設定ファイルを開く</button></div>`;
}
