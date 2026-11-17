import type { StateCore, Token } from "markdown-it";
import type { Mark } from "../render/marks.ts";
import { SLOT_MARKER } from "../shared/own.logic.ts";
import {
  featureOn,
  markOf,
  ownBlock,
  tabBoundaryOf,
} from "../shared/tokens.syntax.ts";
import { renderSection } from "./section.part.ts";

/** 見出しの中身の差し込みインターフェース */
const TITLE_MARKER = "\u0000mdmark-title\u0000";

/** セクションで囲む途中の状態 */
type SectionWriter = {
  state: StateCore;
  out: Token[];
  /** 開いているセクションの見出しの階層 */
  levels: number[];
  /** タブの先頭で開いていたセクションの数（入れ子のタブは内側が後ろ） */
  tabBases: number[];
};

/** セクションの中身の閉じ。タブの先頭の数が今のセクションの数を超えないよう統一する */
function closeBody(writer: SectionWriter): void {
  const { levels, tabBases } = writer;
  levels.pop();
  writer.out.push(ownBlock(writer.state, "</div>"));
  for (let i = 0; i < tabBases.length; i++) {
    tabBases[i] = Math.min(tabBases[i] ?? 0, levels.length);
  }
}

/** タブの境界を読む。タブの中身の中で開いたセクションを、中身の終わりで閉じる */
function readTabBoundary(
  writer: SectionWriter,
  boundary: NonNullable<ReturnType<typeof tabBoundaryOf>>,
): void {
  const { levels, tabBases } = writer;
  if (boundary === "start") {
    tabBases.push(levels.length);
    return;
  }
  while (levels.length > (tabBases[tabBases.length - 1] ?? 0)) {
    closeBody(writer);
  }
  if (boundary === "end") {
    tabBases.pop();
  }
}

/** 見出しの階層と同じか深いセクションを閉じる */
function closeDeeper(writer: SectionWriter, level: number): void {
  const { levels } = writer;
  while (levels.length && (levels[levels.length - 1] ?? 0) >= level) {
    closeBody(writer);
  }
}

/** 見出しの後ろにセクションの中身の開きを配置し、セクションを開く。見出しの直後の `section` のマーカーの `open`（省くと `true`）で開閉を決める */
function openSection(
  writer: SectionWriter,
  heading: { token: Token; inline: Token; level: 1 | 2 | 3 | 4 },
  section: Mark | undefined,
): void {
  const { token, inline, level } = heading;
  const html = renderSection({
    level,
    id: String(token.attrGet("id") ?? ""),
    title: TITLE_MARKER,
    open: section?.options.open !== false,
    toggle: false,
    anchor: false,
    body: SLOT_MARKER,
  });
  const [head = "", rest = ""] = html.split(TITLE_MARKER);
  const [body = ""] = rest.split(SLOT_MARKER);
  writer.out.push(
    ownBlock(writer.state, head, token),
    inline,
    ownBlock(writer.state, body),
  );
  writer.levels.push(level);
}

/** 最上位の見出し 1 つを読み、h1〜h4 ならセクションを開く。読んだ後に飛ばすトークンの数（見出しの 3 つのトークンと、使用したマーカー）を返却する */
function readHeading(
  writer: SectionWriter,
  tokens: Token[],
  index: number,
): number {
  const token = tokens[index] as Token;
  const level = Number(token.tag.slice(1));
  closeDeeper(writer, level);
  const inline = tokens[index + 1];
  if (level > 4 || !inline) {
    writer.out.push(token);
    return 0;
  }
  const mark = markOf(tokens[index + 3]);
  const section = mark?.name === "section" ? mark : undefined;
  openSection(
    writer,
    { token, inline, level: level as 1 | 2 | 3 | 4 },
    section,
  );
  return section ? 3 : 2;
}

/** `sections` がオンなら、h1〜h4 の見出しの後ろから次の同じか上の階層の見出しの前までをセクションの中身の要素で囲む。タブの中身の中で開いたセクションは、次の見出しより前にその中身が終わるときは中身の終わりで閉じる（タブの外で開いたセクションはタブをまたいで続く） */
export function wrapSections(state: StateCore): void {
  if (!featureOn(state, "sections")) {
    return;
  }
  const tokens = state.tokens;
  const writer: SectionWriter = { state, out: [], levels: [], tabBases: [] };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as Token;
    const boundary = tabBoundaryOf(token);
    if (boundary !== undefined) {
      readTabBoundary(writer, boundary);
    }
    if (token.type !== "heading_open" || token.level !== 0) {
      writer.out.push(token);
      continue;
    }
    index += readHeading(writer, tokens, index);
  }
  while (writer.levels.length) {
    closeBody(writer);
  }
  state.tokens = writer.out;
}
