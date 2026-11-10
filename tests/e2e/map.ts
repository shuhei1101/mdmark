import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { MdmarkConfig, MdmarkIndex } from "../../src/index.ts";
import { mountDocument, openPage, PAGE_URL, routeLucide } from "./dist-page.ts";

// map の図を描き終えるまで待つ時間（ミリ秒）
export const MAP_WAIT_MS = 10_000;

/** 使う側の設定の map（3 種類のクラスと 2 種類の線） */
export const MAP_CONFIG = {
  kinds: {
    step: { label: "処理", icon: "cog", shape: "rounded" },
    store: {
      label: "保存先",
      icon: "database",
      shape: "rect",
      color: "purple",
    },
    outside: { label: "外部", icon: "globe", shape: "pill", color: "green" },
  },
  lines: {
    "-.->": { dash: "dashed", head: "open" },
    "==>": { width: "thick", color: "orange" },
  },
};

/** 設定ファイルに記載する map の行 */
export const MAP_CONFIG_YAML = [
  "map:",
  "  kinds:",
  ...Object.entries(MAP_CONFIG.kinds).flatMap(([name, kind]) => [
    `    ${name}:`,
    ...Object.entries(kind).map(([key, value]) => `      ${key}: ${value}`),
  ]),
  "  lines:",
  ...Object.entries(MAP_CONFIG.lines).flatMap(([name, line]) => [
    `    "${name}":`,
    ...Object.entries(line).map(([key, value]) => `      ${key}: ${value}`),
  ]),
];

/** 30 文字に近い長さの、ノードの幅の上限で折り返すラベル */
export const LONG_LABEL =
  "内側のグループから順に配置して外側の大きさを決める自動配置";

/** 用語集の用語（ノードのラベルに含める） */
export const MAP_TERM = "補足";

/** 用語 `補足` を持つ索引 */
export const MAP_TERM_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [],
  terms: [
    {
      id: "data",
      term: MAP_TERM,
      meaning: "map の範囲の Mermaid に付ける JSON の上書きと説明",
    },
  ],
};

/** 構成図: 入れ子 2 レイヤー（外は LR、中は TB）・グループをまたぐ線・3 種類のクラス・種類を書かないノード `frame` */
export const MAP_FLOW = `flowchart LR
  user(["利用側のページ"]):::outside
  subgraph lib [mdmark]
    direction LR
    mount["mount"]:::step
    subgraph read [記法の読み取り]
      direction TB
      marker["map のマーカーの読み取り"]:::step
      mermaid["Mermaid の記法の読み取り"]:::step
      data["${MAP_TERM}の検査"]:::step
    end
    subgraph place [配置]
      direction TB
      layout["${LONG_LABEL}"]:::step
      route["線の経路"]:::step
    end
    frame["図の枠"]
  end
  subgraph store [データ]
    direction TB
    index[("索引")]:::store
    doc[("文書の Markdown")]:::store
  end
  user -->|設定と Markdown| mount
  mount --> marker
  doc -.-> marker
  marker -->|mermaid のブロック| mermaid
  marker -->|補足| data
  index -.-> data
  mermaid -->|ノードと線| layout
  data -->|layout の上書き| layout
  layout --> route
  route <--> frame
  data --> frame
  frame -->|HTML| user
`;

/** ノード `layout` の説明 */
export const NODE_NOTE =
  "内側のグループから配置し、グループの大きさを決めてから外側を配置する";

/** 線 `mount->marker` の説明 */
export const WIRE_NOTE = "map の範囲ごとに 1 つの図の定義に分ける";

/** 構成図の補足の値（`notes`・手順 3 つの `walkthroughs`・グループの色） */
export const MAP_DATA_VALUE = {
  version: 1,
  notes: {
    layout: { text: NODE_NOTE },
    "mount->marker": { text: WIRE_NOTE },
  },
  walkthroughs: [
    {
      title: "mount に渡す",
      text: "利用側のページが、設定と Markdown を mount に渡します。",
      nodes: ["mount"],
    },
    {
      title: "文書と索引を読む",
      text: "文書と索引は、補足の検査に読まれます。\n索引の用語は、ラベルの照合に使います。\n文書は、範囲ごとに分けます。",
      nodes: ["doc", "index", "data"],
    },
    {
      title: "線の経路を決める",
      text: "配置のグループの中で、自動配置の後に線の経路を決めます。",
      enter: "place",
      nodes: ["layout", "route"],
    },
  ],
  layout: {
    read: { color: "blue" },
    place: { color: "green" },
    store: { color: "orange" },
  },
};

/** 構成図の補足（JSON の文字） */
export const MAP_DATA = JSON.stringify(MAP_DATA_VALUE, null, 2);

/** 構成図と同じ ID の参加者 5 人・メッセージ 4 つのシーケンス図（2 つ目のメッセージに説明を持つ） */
export const MAP_PLAY_SEQUENCE = `sequenceDiagram
  participant user as 利用側のページ
  participant mount as mount
  participant marker as map のマーカーの読み取り
  participant mermaid as Mermaid の記法の読み取り
  participant layout as 自動配置
  user->>mount: 設定と Markdown
  mount->>marker: map の範囲
  marker->>mermaid: mermaid のブロック
  mermaid->>layout: ノードと線
`;

/** 再生のシーケンス図の 2 つ目のメッセージの説明 */
export const MESSAGE_NOTE = "範囲ごとに読み取りへ渡す";

/** 再生のシーケンス図の補足（1 つ目の図の上で再生する） */
export const MAP_PLAY_DATA = JSON.stringify({
  version: 1,
  plays_over: 1,
  notes: { "2": { text: MESSAGE_NOTE } },
});

/** 名前の無いブロック 1 つと、loop の中の alt / else を持つシーケンス図（参加者 5 人・メッセージ 7 つ） */
export const MAP_BLOCK_SEQUENCE = `sequenceDiagram
  autonumber
  participant user as 利用側のページ
  participant mount as mount
  participant marker as map のマーカーの読み取り
  participant mermaid as Mermaid の記法の読み取り
  participant layout as 自動配置
  %% block: 描く前の準備
  rect rgb(240, 244, 255)
    user->>+mount: 設定と Markdown
  end
  loop map の範囲ごと
    mount->>marker: map の範囲
    alt mermaid のブロックがある
      marker->>mermaid: mermaid のブロック
      mermaid->>layout: ノードと線
      layout-->>mount: 配置した図
    else ブロックが無い
      marker--xmount: 書き方の警告
    end
  end
  Note over user,mount: 全ての範囲を描き終えてから返す
  mount-->>-user: 描いた文書
`;

/** map の範囲の Markdown を組み立てる */
export function mapRange(options: {
  args?: string;
  mermaid?: string;
  data?: string;
}): string {
  const open =
    options.args === undefined
      ? "<!-- map -->"
      : `<!-- map: ${options.args} -->`;
  const block =
    options.mermaid === undefined
      ? ""
      : `\n\n\`\`\`mermaid\n${options.mermaid}\`\`\`\n`;
  const data =
    options.data === undefined ? "" : `\n<!-- map-data: ${options.data} -->\n`;
  return `${open}${block}${data}\n<!-- /map -->\n`;
}

/** 構成図の範囲（印に `{"title": "全体の構成"}`） */
export const FLOW_RANGE = mapRange({
  args: '{"title": "全体の構成"}',
  mermaid: MAP_FLOW,
  data: MAP_DATA,
});

/** 構成図と、その上で再生するシーケンス図の 2 つの範囲 */
export const BOTH_RANGES = `${FLOW_RANGE}\n${mapRange({
  args: '{"title": "描くまでの流れ"}',
  mermaid: MAP_PLAY_SEQUENCE,
  data: MAP_PLAY_DATA,
})}`;

/** 文書の中の n 番目（0 から）の map の図 */
export function mapFigure(page: Page, n = 0): Locator {
  return page.locator('#doc figure.mdmark-diagram[data-diagram="map"]').nth(n);
}

/** 図の中の data-node の要素（構成図のノードかシーケンス図の参加者） */
export function mapNode(figure: Locator, id: string): Locator {
  return figure.locator(`.mdmark-diagram-node[data-node="${id}"]`);
}

/** 構成図の線 */
export function mapWire(figure: Locator, id: string): Locator {
  return figure.locator(`path.mdmark-diagram-wire[data-wire="${id}"]`);
}

/** 構成図の線の押せる帯 */
export function mapWireHit(figure: Locator, id: string): Locator {
  return figure.locator(`.map-wire-hit[data-wire="${id}"]`);
}

/** 図の右上の map のツールのボタン（`back`・`expandAll`・`collapseAll`・`reset`） */
export function mapTool(figure: Locator, name: string): Locator {
  return figure.locator(
    `.mdmark-diagram-tools-group[data-group="map"] [data-tool="${name}"]`,
  );
}

/** 案内・再生の帯のボタン（`prev`・`stop`・`auto`・`next`） */
export function bandButton(figure: Locator, name: string): Locator {
  return figure.locator(`.map-band [data-band="${name}"]`);
}

/** 案内・再生の帯の番号 */
export function bandCount(figure: Locator): Locator {
  return figure.locator(".map-band-count");
}

/** 要素が薄くした表示（`map-dim`）か */
export function isDimmed(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.classList.contains("map-dim"));
}

/** 要素が選んだ状態（`data-selected`）か */
export function isSelected(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.hasAttribute("data-selected"));
}

/** データの印を流している線（構成図は `data-wire`、シーケンス図は `data-message`） */
export function packetOwners(figure: Locator): Promise<string[]> {
  return figure
    .locator(".map-packet")
    .evaluateAll((packets) => [
      ...new Set(
        packets.map(
          (packet) =>
            packet.getAttribute("data-wire") ??
            packet.getAttribute("data-message") ??
            "",
        ),
      ),
    ]);
}

/** 2 つの矩形が重なるか（辺が接するだけは重ならない） */
export function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width - 0.5 &&
    b.x < a.x + a.width - 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    b.y < a.y + a.height - 0.5
  );
}

/** 表示する枠のスクロールの位置・図の倍率・表示する枠の高さ・文書のスクロールの位置 */
export function viewState(figure: Locator): Promise<{
  scroll: [number, number];
  transform: string;
  height: number;
  page: [number, number];
}> {
  return figure.evaluate((element) => {
    const viewport = element.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    const stage = element.querySelector<HTMLElement>(".mdmark-diagram-stage");
    return {
      scroll: [viewport?.scrollLeft ?? 0, viewport?.scrollTop ?? 0],
      transform: stage ? getComputedStyle(stage).transform : "",
      height: viewport?.getBoundingClientRect().height ?? 0,
      page: [window.scrollX, window.scrollY],
    };
  });
}

/** 要素の中心の座標 */
export async function centerOf(locator: Locator): Promise<[number, number]> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("要素の矩形が無い");
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** 要素の中心を押したまま、dx・dy だけ動かして離す */
export async function dragBy(
  page: Page,
  locator: Locator,
  dx: number,
  dy: number,
): Promise<void> {
  const [x, y] = await centerOf(locator);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

/** ページの URL のクエリ文字列を、履歴を増やさずに差し替える（ページの HTML の応答はクエリ文字列の無い URL だけに当てる） */
async function setSearch(page: Page, search: string): Promise<void> {
  await page.evaluate(
    (value) => history.replaceState(null, "", `${location.pathname}${value}`),
    search,
  );
}

/** jsDelivr の配布物と Lucide のアイコンを手元の応答に差し替えたページを開き、文書を描いて map の図が出るまで待つ。sessionStorage は空にし、`search` があればクエリ文字列にする */
export async function openMap(
  page: Page,
  root: string,
  options: {
    markdown: string;
    config?: MdmarkConfig;
    index?: MdmarkIndex;
    hostCss?: string;
    search?: string;
  },
): Promise<void> {
  await routeLucide(page);
  await openPage(
    page,
    root,
    options.hostCss === undefined ? {} : { hostCss: options.hostCss },
  );
  await page.evaluate(() => sessionStorage.clear());
  if (options.search !== undefined) await setSearch(page, options.search);
  await mountDocument(page, {
    markdown: options.markdown,
    config: (options.config ?? { map: MAP_CONFIG }) as MdmarkConfig,
    ...(options.index === undefined ? {} : { index: options.index }),
  });
  await expect(mapFigure(page)).toBeVisible({ timeout: MAP_WAIT_MS });
}

/** 同じタブでページを開き直し、同じ Markdown をもう一度描く。sessionStorage とクエリ文字列は残す */
export async function reloadMap(
  page: Page,
  options: { markdown: string; config?: MdmarkConfig },
): Promise<void> {
  const search = await page.evaluate(() => location.search);
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => "mdmark" in window);
  if (search !== "") await setSearch(page, search);
  await mountDocument(page, {
    markdown: options.markdown,
    config: (options.config ?? { map: MAP_CONFIG }) as MdmarkConfig,
  });
  await expect(mapFigure(page)).toBeVisible({ timeout: MAP_WAIT_MS });
}

/** 今のクエリ文字列の値 */
export function searchParam(page: Page, key: string): Promise<string | null> {
  return page.evaluate(
    (name) => new URLSearchParams(location.search).get(name),
    key,
  );
}

/** 線（`path`）の上の、長さの割合 `at` の点のページの座標 */
export function pointOnPath(
  path: Locator,
  at = 0.5,
): Promise<[number, number]> {
  return path.evaluate((element, ratio) => {
    const line = element as SVGPathElement;
    const point = line.getPointAtLength(line.getTotalLength() * ratio);
    const matrix = line.getScreenCTM();
    if (!matrix) throw new Error("線の座標を変換できない");
    return [
      point.x * matrix.a + point.y * matrix.c + matrix.e,
      point.x * matrix.b + point.y * matrix.d + matrix.f,
    ] as [number, number];
  }, at);
}

/** 線の押せる帯の真ん中を押す */
export async function clickWire(
  page: Page,
  figure: Locator,
  id: string,
): Promise<void> {
  const [x, y] = await pointOnPath(mapWireHit(figure, id));
  await page.mouse.click(x, y);
}

/** 色の式を、文書の `.mdmark` の中で解決した computed の色にする */
export function resolveColor(page: Page, expression: string): Promise<string> {
  return page.evaluate((value) => {
    const host = document.querySelector("#doc .mdmark") ?? document.body;
    const probe = document.createElement("span");
    probe.style.color = value;
    host.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, expression);
}

/** 図の段の左上からの、ノードの位置と大きさ（`data-node` ごと） */
export function nodeLayout(
  figure: Locator,
): Promise<Record<string, [number, number, number, number]>> {
  return figure
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => {
          const element = node as HTMLElement;
          return [
            element.dataset.node ?? "",
            [
              element.offsetLeft,
              element.offsetTop,
              element.offsetWidth,
              element.offsetHeight,
            ],
          ];
        }),
      ),
    );
}
