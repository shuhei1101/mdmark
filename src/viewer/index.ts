import type { ExportPayload } from "../cli/html.ts";
import { mount } from "../mount.ts";
import { startBundle } from "./bundle.ts";
import { prepareModules } from "./modules.ts";

/** 書き出しの中身を埋めた `script` 要素の `id` */
const PAYLOAD_ID = "mdmark-payload";

/** 書き出した HTML を起動する: 埋めた中身を読み、モジュールと拡張を用意してから、1 文書は描く先の要素に描き、まとめた HTML は画面を起動する */
export async function startViewer(doc: Document): Promise<void> {
  const element = doc.getElementById(PAYLOAD_ID);
  if (!element?.textContent) {
    throw new Error(`#${PAYLOAD_ID} がありません`);
  }
  const payload = JSON.parse(element.textContent) as ExportPayload;
  const config = await prepareModules(payload);
  if (payload.kind === "bundle") {
    startBundle(doc, payload, config);
    return;
  }
  const target = doc.querySelector<HTMLElement>("article.mdmark");
  const entry = payload.docs.find((item) => item.path === payload.entry);
  if (!target || !entry) {
    throw new Error("描く先の要素か文書がありません");
  }
  mount(target, {
    markdown: entry.markdown,
    config,
    ...(payload.index ? { index: payload.index } : {}),
    ...(entry.docId ? { docId: entry.docId } : {}),
    ...(payload.references ? { references: payload.references } : {}),
    ...(payload.aliases ? { aliases: payload.aliases } : {}),
  });
}

// 書き出した HTML の入口として読まれたときに起動する
void startViewer(document);
