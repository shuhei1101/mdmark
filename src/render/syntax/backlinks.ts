import type { StateCore } from "markdown-it";
import { readRelated } from "../../knowledge/index-shape.ts";
import { relativeHref } from "../../knowledge/paths.ts";
import { renderBacklinks } from "../../parts/backlinks.ts";
import { envOf, featureOn, ownBlock } from "./tokens.ts";

/** 関連文書の一覧の題の `id`（ページで一意にするのは `attachTermTips`） */
const TITLE_ID = "mdmark-backlinks-title";

/** `backlinks` がオンで描く文書を参照している文書があれば、本文の末尾に関連文書の一覧を足す */
export function backlinksRule(state: StateCore): void {
  const env = envOf(state);
  const { index, docId } = env;
  if (!featureOn(state, "backlinks") || !index || docId === undefined) {
    return;
  }
  // 参照の表があればその被参照、無ければ索引の `related` の相手に描く文書を持つ文書
  const ids =
    env.mdmarkReferences?.backlinks[docId] ??
    index.docs
      .filter((doc) =>
        (doc.related ?? []).some((item) => readRelated(item).to === docId),
      )
      .map((doc) => doc.id);
  const ownPath = index.docs.find((doc) => doc.id === docId)?.path;
  const docs = [...new Set(ids)]
    .filter((id) => id !== docId)
    .flatMap((id) => index.docs.filter((doc) => doc.id === id))
    .map((doc) => ({
      title: doc.title,
      href: relativeHref(ownPath, doc.path),
    }));
  const html = renderBacklinks({ id: TITLE_ID, docs });
  if (html !== "") {
    state.tokens.push(ownBlock(state, html));
  }
}
