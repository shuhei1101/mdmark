import type { ExportPayload } from "../cli/html.ts";
import { mount } from "../mount.ts";
import { startBundle } from "./bundle.ts";
import { includesOf, knowledgeOptions } from "./includes.ts";
import { type EmbeddedModules, prepareModules } from "./modules.ts";

/** 書き出しの中身を埋めた `script` 要素の `id` */
const PAYLOAD_ID = "mdmark-payload";

/** 埋めた中身を読み込む。無ければ例外を投げる */
function readPayload(doc: Document): ExportPayload {
  const element = doc.getElementById(PAYLOAD_ID);
  if (!element?.textContent) {
    throw new Error(`#${PAYLOAD_ID} がありません`);
  }
  return JSON.parse(element.textContent) as ExportPayload;
}

/** 書き出した HTML を起動する: 埋めた中身を読み込み、まとめたモジュールと拡張を用意してから、1 文書は描く先の要素に描き、まとめた HTML は画面を起動する。CLI がまとめる入口のモジュールが呼ぶ */
export async function startViewer(
  doc: Document,
  embedded: EmbeddedModules,
): Promise<void> {
  const payload = readPayload(doc);
  await prepareModules(embedded);
  const config = payload.config;
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
    ...knowledgeOptions(payload, entry.docId),
    includes: includesOf(payload, entry),
    ...(payload.icons ? { icons: payload.icons } : {}),
  });
}
