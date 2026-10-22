import {
  Archive,
  Ban,
  Bug,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleX,
  Clock,
  Eye,
  Flag,
  type IconNode,
  Inbox,
  Lock,
  SquareKanban,
  Star,
  Table,
  Zap,
} from "lucide";
import type { FilterValue } from "../table-logic.ts";
import {
  DEFAULT_VALUE_ICONS,
  FALLBACK_VALUE_ICON,
  type ViewIconName,
} from "../views/spec.ts";
import { escapeHtml } from "./escape.ts";
import { iconNodeBody, iconSvgOf } from "./icon-node.ts";
import { renderTable, type TableFilter } from "./table.ts";

/** アイコンの名前から lucide のアイコンの形を引く */
const ICON_NODES: Record<ViewIconName | "board" | "table", IconNode> = {
  circle: Circle,
  "circle-dashed": CircleDashed,
  "circle-dot": CircleDot,
  "circle-pause": CirclePause,
  "circle-check": CircleCheck,
  "circle-x": CircleX,
  inbox: Inbox,
  archive: Archive,
  clock: Clock,
  flag: Flag,
  star: Star,
  bug: Bug,
  eye: Eye,
  lock: Lock,
  zap: Zap,
  ban: Ban,
  board: SquareKanban,
  table: Table,
};

/** 使えるアイコンと切り替えの `board`・`table` の、24 の格子の lucide の svg の中身 */
export const VIEW_ICON_PATHS: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(ICON_NODES).map(([name, node]) => [
      name,
      iconNodeBody(node),
    ]),
  );

/** 名前のアイコンの svg を返す。知らない名前は既定のアイコンにする */
function viewIcon(name: string): string {
  const body = Object.hasOwn(VIEW_ICON_PATHS, name)
    ? VIEW_ICON_PATHS[name]
    : VIEW_ICON_PATHS[FALLBACK_VALUE_ICON];
  return iconSvgOf(body ?? "");
}

/** 切り替えのボタン 1 つの HTML を返す */
function switchButton(options: {
  mode: "board" | "table";
  label: string;
  current: "board" | "table";
  disabledBy?: string | undefined;
}): string {
  const { mode, label, current, disabledBy } = options;
  const disabled = disabledBy
    ? ` disabled aria-describedby="${escapeHtml(disabledBy)}"`
    : "";
  return `<button class="mdmark-view-switch-item" type="button" data-mode="${mode}" aria-pressed="${mode === current}"${disabled}>${viewIcon(mode)}${label}</button>`;
}

/** 「ボード」「表」の切り替えの HTML を返す */
export function renderViewSwitch(props: {
  /** 出すビュー */
  mode: "board" | "table";
  /** ボードにできない理由の書き方の警告の `id` */
  boardDisabled?: string | undefined;
}): string {
  const { mode, boardDisabled } = props;
  return `<div class="mdmark-view-switch" role="group" aria-label="ビューの表示">${switchButton({ mode: "board", label: "ボード", current: mode, disabledBy: boardDisabled })}${switchButton({ mode: "table", label: "表", current: mode })}</div>`;
}

/** ボードの項目 1 つの HTML を返す: 先頭の列の値を題にし、`group` の列と空の値を除いた列を列名と値の組で並べる */
function renderCard(options: {
  columns: string[];
  row: string[];
  group: number;
}): string {
  const { columns, row, group } = options;
  const fields = columns
    .map((name, index) => ({ name, value: row[index] ?? "", index }))
    .filter(
      ({ index, value }) => index !== 0 && index !== group && value !== "",
    )
    .map(
      ({ name, value }) =>
        `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  const list = fields ? `<dl class="mdmark-view-fields">${fields}</dl>` : "";
  return `<li class="mdmark-view-card"><p class="mdmark-view-card-title">${escapeHtml(row[0] ?? "")}</p>${list}</li>`;
}

/** 値ごとの列に項目を並べたボードの HTML を返す。`group` が列の位置でなければ空のボード */
export function renderViewBoard(props: {
  /** 列名 */
  columns: string[];
  /** 項目ごとの値（`columns` と同じ並び） */
  items: string[][];
  /** 分ける列の位置 */
  group: number;
  /** 値からアイコンの名前を引く上書きの対応 */
  icons: Record<string, string>;
  /** 隠すか（既定 `false`） */
  hidden?: boolean;
}): string {
  const { columns, items, group, icons, hidden = false } = props;
  const open = `<div class="mdmark-view-board" role="group" aria-label="ボード" tabindex="0"${hidden ? " hidden" : ""}>`;
  if (group < 0 || group >= columns.length) {
    return `${open}</div>`;
  }
  // 値は表に出た順に並べる
  const values = [...new Set(items.map((row) => row[group] ?? ""))];
  const columnsHtml = values.map((value) => {
    const rows = items.filter((row) => (row[group] ?? "") === value);
    const iconName = Object.hasOwn(icons, value)
      ? icons[value]
      : Object.hasOwn(DEFAULT_VALUE_ICONS, value)
        ? DEFAULT_VALUE_ICONS[value]
        : FALLBACK_VALUE_ICON;
    const label = escapeHtml(value);
    const cards = rows
      .map((row) => renderCard({ columns, row, group }))
      .join("");
    return `<div class="mdmark-view-column"><p class="mdmark-view-column-head">${viewIcon(iconName ?? FALLBACK_VALUE_ICON)}<span class="mdmark-view-column-name">${label}</span><span class="mdmark-view-column-count">${rows.length.toLocaleString("ja-JP")}</span></p><ul class="mdmark-view-cards" aria-label="${label}">${cards}</ul></div>`;
  });
  return `${open}${columnsHtml.join("")}</div>`;
}

/** 項目の表を、`group` の列の値ごとに並べたボードと、表形式で切り替えて出す HTML を返す */
export function renderView(props: {
  /** 列名 */
  columns: string[];
  /** 項目ごとの値（`columns` と同じ並び） */
  items: string[][];
  /** ボードで分ける列名。無ければ切り替えを置かず、表形式だけを出す */
  group?: string | undefined;
  /** 出しているビュー（既定は `group` があればボード） */
  mode?: "board" | "table" | undefined;
  /** 表形式で絞り込みを付ける列 */
  filters?: TableFilter[] | undefined;
  /** 表形式に当てている絞り込み */
  filterValues?: FilterValue[] | undefined;
  /** 開いた絞り込みのドロワーの列の位置 */
  openFilter?: number | undefined;
  /** ボードの列の見出しのアイコンの上書き */
  icons?: Record<string, string> | undefined;
  /** ボードにできない理由の書き方の警告の `id` */
  boardDisabled?: string | undefined;
  /** ビューの要素の `id` の頭 */
  id: string;
}): string {
  const { columns, items, group, filters = [], icons = {}, id } = props;
  const groupIndex = group === undefined ? -1 : columns.indexOf(group);
  const switchable = group !== undefined;
  const boardUsable = groupIndex >= 0 && !props.boardDisabled;
  const mode = boardUsable ? (props.mode ?? "board") : "table";
  const hiddenIf = (hide: boolean): string => (hide ? " hidden" : "");
  const head = switchable
    ? renderViewSwitch({ mode, boardDisabled: props.boardDisabled }) +
      renderViewBoard({
        columns,
        items,
        group: groupIndex,
        icons,
        hidden: mode !== "board",
      })
    : "";
  const table = renderTable({
    kind: "data",
    features: filters.length > 0 ? ["sort", "filter"] : ["sort"],
    columns: columns.map(escapeHtml),
    rows: items.map((row) => row.map(escapeHtml)),
    filters,
    filterValues: props.filterValues ?? [],
    ...(props.openFilter === undefined ? {} : { openFilter: props.openFilter }),
    id: `${id}-table`,
  });
  return `<div class="mdmark-view">${head}<div class="mdmark-view-table"${hiddenIf(mode !== "table")}>${table}</div></div>`;
}
