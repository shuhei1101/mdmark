import { styleColor } from "../shared/style-tokens.logic.ts";
import type { ReplyBlock } from "./blocks.ts";
import { foldStates, type RenderContext } from "./reply.tsx";
import { displayWidth } from "./table-layout.ts";
import type { UiNode } from "./user-message.tsx";

/** mod の環境が持つ JSX の factory */
declare const h: (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => UiNode;

/** 中身のブロックの並びを描く関数 */
export type RenderBody = (blocks: ReplyBlock[]) => UiNode;

/** ファイルツリーの名前と注釈の間の最小の空白 */
const TREE_NOTE_GAP = 2;

/** `steps` のブロックを、見出しの色の太字の番号と項目の中身の行と、項目の間の罫線の色の `│` の行で描く */
export const renderSteps = (options: {
  block: ReplyBlock;
  context: RenderContext;
  renderBody: RenderBody;
}): UiNode => {
  const { block, context, renderBody } = options;
  const { Box, Text } = context.elements;
  const items = block.steps?.items ?? [];
  const heading = styleColor({ name: "heading", theme: context.theme });
  const border = styleColor({ name: "border", theme: context.theme });
  return h(
    Box,
    { key: `steps-${block.line}`, flexDirection: "column" },
    ...items.flatMap((item, index) => [
      h(
        Box,
        { key: `step-${index}`, flexDirection: "row" },
        h(Text, { bold: true, color: heading }, String(index + 1)),
        h(Text, null, " "),
        h(Box, { flexDirection: "column" }, renderBody(item)),
      ),
      index < items.length - 1
        ? h(Text, { key: `step-line-${index}`, color: border }, "│")
        : undefined,
    ]),
  );
};

/** `tree` のブロックを、行ごとに薄い色の罫線・本文の色の名前・同じ桁にそろえた薄い色の注釈の Text で描く */
export const renderTree = (options: {
  block: ReplyBlock;
  context: RenderContext;
}): UiNode => {
  const { block, context } = options;
  const { Box, Text } = context.elements;
  const lines = block.tree?.lines ?? [];
  const noteAt = Math.max(
    0,
    ...lines.map((line) => displayWidth(`${line.rule}${line.name}`)),
  );
  return h(
    Box,
    { key: `tree-${block.line}`, flexDirection: "column" },
    ...lines.map((line, index) => {
      const pad =
        noteAt - displayWidth(`${line.rule}${line.name}`) + TREE_NOTE_GAP;
      return h(
        Box,
        { key: `tree-line-${index}`, flexDirection: "row" },
        h(Text, { dimColor: true }, line.rule),
        h(Text, null, line.name),
        line.note === undefined ? undefined : h(Text, null, " ".repeat(pad)),
        line.note === undefined
          ? undefined
          : h(Text, { dimColor: true }, line.note),
      );
    }),
  );
};

/** `stack` のブロックの区切りを記載した順に縦に並べる。タブはタブ名を見出しで描き、中身を 2 桁字下げする */
export const renderStack = (options: {
  block: ReplyBlock;
  context: RenderContext;
  renderBody: RenderBody;
}): UiNode => {
  const { block, context, renderBody } = options;
  const { Box, Text } = context.elements;
  const heading = styleColor({ name: "heading", theme: context.theme });
  return h(
    Box,
    { key: `stack-${block.line}`, flexDirection: "column" },
    ...(block.stack?.sections ?? []).map((section, index) =>
      section.title === undefined
        ? h(
            Box,
            { key: `section-${index}`, flexDirection: "column" },
            renderBody(section.body),
          )
        : h(
            Box,
            { key: `section-${index}`, flexDirection: "column" },
            h(Text, { bold: true, color: heading }, section.title),
            h(
              Box,
              { flexDirection: "column", paddingLeft: 2 },
              renderBody(section.body),
            ),
          ),
    ),
  );
};

/** 詳細を持つ行の先頭のセルに配置する開閉の Button と、開いているときの詳細を返却する。押すと状態を反転して描き直す */
export const renderRowDetail = (options: {
  key: string;
  body: () => UiNode;
  context: RenderContext;
}): { toggle: UiNode; detail?: UiNode } => {
  const { key, body, context } = options;
  const { Box, Button } = context.elements;
  const open = foldStates.get(key) ?? false;
  const toggle = h(Button, {
    key: `${key}:button`,
    label: open ? "[ ▾ ]" : "[ ▸ ]",
    onPress: () => {
      foldStates.set(key, !(foldStates.get(key) ?? false));
      context.ui.invalidate("ui.render");
    },
  });
  if (!open) {
    return { toggle };
  }
  return {
    toggle,
    detail: h(
      Box,
      { key: `${key}:detail`, flexDirection: "column", paddingLeft: 2 },
      body(),
    ),
  };
};
