import { ASSET_SCHEME, type ExportPayload } from "../cli/html.ts";
import type { MdmarkConfig } from "../config.ts";
import { type MountHandle, mount } from "../mount.ts";
import { renderDocList } from "../parts/doc-list.ts";
import { DOC_HASH_PREFIX, resolveRoute, rewriteLinks } from "./route.ts";

/** 横の文書の一覧を出し、パネルを閉じる幅のメディアクエリ（CSS の境と同じ値） */
export const WIDE_QUERY = "(min-width: 60rem)";

/** 開いている文書の行に付ける属性 */
const CURRENT_ATTRIBUTE = "aria-current";

/** 埋めた画像のキーと、後ろのフラグメントを読む正規表現 */
const ASSET_PATTERN = new RegExp(`${ASSET_SCHEME}([A-Za-z0-9_-]+)`, "g");

/** 文書の Markdown の `mdmark-asset:{キー}` を `assets` の `data:` URL に替える。後ろのフラグメントは残し、`assets` に無いキーは替えない */
export function restoreAssets(
  markdown: string,
  assets: Record<string, string> | undefined,
): string {
  if (assets === undefined) {
    return markdown;
  }
  return markdown.replace(ASSET_PATTERN, (found, key: string) =>
    Object.hasOwn(assets, key) ? (assets[key] as string) : found,
  );
}

/** 画面の骨組みの要素を引く。無ければ例外を投げる */
function requireElement<T extends Element>(
  parent: ParentNode,
  selector: string,
): T {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    throw new Error(`画面の要素がありません: ${selector}`);
  }
  return element;
}

/** まとめた HTML を起動する: 横の一覧とパネルに文書の一覧を置き、URL の `#` が指す文書を `mount` で描き、`hashchange` で文書を行き来する */
export function startBundle(
  doc: Document,
  payload: ExportPayload,
  config: MdmarkConfig,
): void {
  const win = doc.defaultView ?? window;
  const side = requireElement<HTMLElement>(doc, ".mdmark-bundle-side");
  const panel = requireElement<HTMLDialogElement>(doc, ".mdmark-bundle-panel");
  const panelBody = requireElement<HTMLElement>(panel, "[data-panel-body]");
  const openButton = requireElement<HTMLButtonElement>(
    doc,
    "[data-panel-open]",
  );
  const closeButton = requireElement<HTMLButtonElement>(
    panel,
    "[data-panel-close]",
  );
  const barTitle = requireElement<HTMLElement>(doc, "[data-bar-title]");
  const view = requireElement<HTMLElement>(doc, "[data-doc-view]");

  const paths = new Set(payload.docs.map((item) => item.path));
  const list = renderDocList({
    docs: payload.docs.map(({ path, title }) => ({ path, title })),
  });
  side.innerHTML = list;
  panelBody.innerHTML = list;

  // 今描いている文書のパスと、その `mount` の戻り値
  let currentPath: string | undefined;
  let handle: MountHandle | undefined;

  /** 文書を差し替え、一覧の開いている文書・帯の題・ページの題を合わせる */
  const showDocument = (path: string): void => {
    const item = payload.docs.find((candidate) => candidate.path === path);
    if (!item) {
      throw new Error(`まとめた文書に無い: ${path}`);
    }
    handle?.destroy();
    handle = mount(view, {
      markdown: restoreAssets(item.markdown, payload.assets),
      config,
      ...(payload.index ? { index: payload.index } : {}),
      ...(item.docId ? { docId: item.docId } : {}),
      ...(payload.references ? { references: payload.references } : {}),
      ...(payload.aliases ? { aliases: payload.aliases } : {}),
    });
    rewriteLinks(view, path, paths);
    currentPath = path;
    // 横とパネルの両方の一覧で、開いている文書の行だけに付ける
    for (const link of doc.querySelectorAll<HTMLAnchorElement>(
      ".mdmark-doc-list a",
    )) {
      if (link.dataset.docPath === path) {
        link.setAttribute(CURRENT_ATTRIBUTE, "page");
      } else {
        link.removeAttribute(CURRENT_ATTRIBUTE);
      }
    }
    barTitle.textContent = item.title;
    doc.title = item.title;
  };

  /** URL の `#` のとおりに文書を出し、見出しを指していればそこへ、文書だけが替わったときは頭へ移す */
  const route = (initial: boolean): void => {
    const { path, heading, missing } = resolveRoute(
      win.location.hash,
      paths,
      payload.entry,
    );
    // 1 枚に無い文書を指す URL: entry の文書を出し、URL も entry に合わせる（履歴に積まない）
    if (missing) {
      win.history.replaceState(null, "", `${DOC_HASH_PREFIX}${payload.entry}`);
    }
    const switched = path !== currentPath;
    if (switched) {
      showDocument(path);
    }
    const target = heading ? doc.getElementById(heading) : null;
    if (target) {
      target.scrollIntoView();
    } else if (switched) {
      win.scrollTo(0, 0);
    }
    // 文書を移ったら、読み上げとキーボードの位置を文書の題へ移す（開いた直後は移さない）
    if (switched && !initial) {
      const title = view.querySelector<HTMLElement>("h1");
      if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: target !== null });
      }
    }
  };

  win.addEventListener("hashchange", () => route(false));
  // 開いている文書の中の見出しへ移るリンク（見出しのアンカー・目次）は、履歴に積まず今の項目を置き換える（戻るで文書を行き来できる）
  view.addEventListener("click", (event) => {
    const link =
      event.target instanceof Element ? event.target.closest("a") : null;
    const href = link?.getAttribute("href");
    const plain =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (
      href?.startsWith(`${DOC_HASH_PREFIX}${currentPath}#`) &&
      plain &&
      !event.defaultPrevented
    ) {
      event.preventDefault();
      win.history.replaceState(null, "", href);
      route(false);
    }
  });
  route(true);

  // パネルを開き、開いている文書の行へフォーカスを置く
  openButton.addEventListener("click", () => {
    panel.showModal();
    openButton.setAttribute("aria-expanded", "true");
    panel
      .querySelector<HTMLElement>(`.mdmark-doc-list a[${CURRENT_ATTRIBUTE}]`)
      ?.focus();
  });
  panel.addEventListener("close", () => {
    openButton.setAttribute("aria-expanded", "false");
  });
  closeButton.addEventListener("click", () => panel.close());
  // パネルで文書を選んだら閉じる（移るのはリンクの `#` の変化に任せる）
  panel.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      panel.close();
    }
  });
  // `closedby` を持たないブラウザ: 背景の押下を座標で判定して閉じる
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    panel.addEventListener("click", (event) => {
      if (event.target !== panel) {
        return;
      }
      const rect = panel.getBoundingClientRect();
      const inside =
        rect.left <= event.clientX &&
        event.clientX <= rect.right &&
        rect.top <= event.clientY &&
        event.clientY <= rect.bottom;
      if (!inside) {
        panel.close();
      }
    });
  }
  // 広い幅に戻ったら、横の一覧が出るのでパネルを閉じる
  win.matchMedia(WIDE_QUERY).addEventListener("change", (event) => {
    if (event.matches && panel.open) {
      panel.close();
    }
  });
}
