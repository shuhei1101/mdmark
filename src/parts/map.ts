import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 部品『案内の帯』の引数 */
export type MapBandArgs = {
  mode: "walkthrough" | "playback";
  total: number;
  index: number | undefined;
  title: string;
  text: string;
  auto: boolean;
  label: string;
};

/** モードごとのボタンのスクリーンリーダー向けの名前 */
const NAMES = {
  walkthrough: { prev: "前の手順", stop: "案内をやめる", next: "次の手順" },
  playback: {
    prev: "前のメッセージ",
    stop: "再生をやめる",
    next: "次のメッセージ",
  },
} as const;

/** 部品『案内の帯』の HTML */
export const renderMapBand = (args: MapBandArgs): string => {
  const names = NAMES[args.mode];
  const button = (
    action: string,
    label: string,
    icon: Parameters<typeof iconSvg>[0],
    extra = "",
  ) =>
    `<button class="mdmark-diagram-tool" type="button" data-band="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"${extra}>${iconSvg(icon)}</button>`;
  const count = `${args.index === undefined ? "–" : args.index + 1}/${args.total}`;
  const title = `<strong class="map-band-title"${args.title === "" ? " hidden" : ""}>${escapeHtml(args.title)}</strong>`;
  const text = `<p class="map-band-text" aria-live="polite"${args.text === "" ? " hidden" : ""}>${escapeHtml(args.text)}</p>`;
  const actions = [
    button("prev", names.prev, "chevron-left"),
    button(
      "stop",
      names.stop,
      "square",
      args.index === undefined ? ' disabled="disabled"' : "",
    ),
    button(
      "auto",
      args.auto ? "一時停止" : "自動で進める",
      args.auto ? "pause" : "play",
      ` aria-pressed="${args.auto}"`,
    ),
    button("next", names.next, "chevron-right"),
  ].join("");
  return `<div class="map-band" role="region" aria-label="${escapeHtml(args.label)}" data-mode="${args.mode}"><div class="map-band-head"><span class="map-band-count">${count}</span>${title}<div class="map-band-actions">${actions}</div></div>${text}</div>`;
};
