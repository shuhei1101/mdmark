import type { StateCore } from "markdown-it";
import { renderFrontmatter } from "../../parts/frontmatter.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import { envOf, featureOn, ownBlock } from "./tokens.ts";

/** `frontmatter` がオンで中身が空白だけでないとき、本文の先頭にフロントマターの折りたたみと、中身の yaml の fence を差し込む */
export const insertFrontmatter = (state: StateCore): void => {
  const frontmatter = envOf(state).frontmatter;
  if (
    frontmatter === undefined ||
    frontmatter.content.trim() === "" ||
    !featureOn(state, "frontmatter")
  ) {
    return;
  }
  const [head = "", tail = ""] = renderFrontmatter({ body: SLOT_MARKER }).split(
    SLOT_MARKER,
  );
  const fence = new state.Token("fence", "code", 0);
  fence.block = true;
  fence.info = "yaml";
  fence.markup = "```";
  fence.content = `${frontmatter.content}\n`;
  // 中身はフロントマターの 2 行目から閉じる行の前まで
  fence.map = [1, frontmatter.endLine + 1];
  state.tokens = [
    ownBlock(state, head),
    fence,
    ownBlock(state, tail),
    ...state.tokens,
  ];
};
