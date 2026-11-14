import { ASSET_SCHEME, type ExportPayload } from "../cli/html.ts";
import type { MdmarkConfig } from "../config.ts";
import { MAP_QUERY_PREFIX } from "../map/state.ts";
import { type MountHandle, mount } from "../mount.ts";
import { renderDocList } from "../parts/doc-list.ts";
import { includesOf, knowledgeOptions } from "./includes.ts";
import { DOC_HASH_PREFIX, resolveRoute, rewriteLinks } from "./route.ts";
import {
  applyViewState,
  captureViewState,
  ensureEntryId,
  readViewState,
  SCROLL_SAVE_INTERVAL_MS,
  writeViewState,
} from "./view-state.ts";

/** 横の文書の一覧を出し、パネルを閉じる幅のメディアクエリ（CSS の境と同じ値） */
export const WIDE_QUERY = "(min-width: 60rem)";

/** 開いている文書の行に付ける属性 */
const CURRENT_ATTRIBUTE = "aria-current";

/** 埋めた画像のキーと、後ろのフラグメントを読み込む正規表現 */
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

/** 画面の骨組みの要素を参照する。無ければ例外を投げる */
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

/** 横とパネルの両方の一覧で、開いている文書の行だけに `aria-current` を付ける */
function markCurrentDoc(doc: Document, path: string): void {
  for (const link of doc.querySelectorAll<HTMLAnchorElement>(
    ".mdmark-doc-list a",
  )) {
    if (link.dataset.docPath === path) {
      link.setAttribute(CURRENT_ATTRIBUTE, "page");
    } else {
      link.removeAttribute(CURRENT_ATTRIBUTE);
    }
  }
}

/** 修飾キーの無い主ボタンの押下で、既定の動きを止めていないか */
function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/** まとめた HTML を起動する: 横の一覧とパネルに文書の一覧を配置し、URL の `#` が指す文書を `mount` で描き、`hashchange` で文書を行き来する */
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
  // 今の履歴の項目の ID と、表示の状態の合わせ直しを止める関数
  win.history.scrollRestoration = "manual";
  let entryId = ensureEntryId(win);
  let stopRestore: (() => void) | undefined;

  /** 今の履歴の項目の ID へ、描いている文書の表示の状態を保存する */
  const saveViewState = (): void => {
    if (currentPath === undefined) {
      return;
    }
    writeViewState({
      win,
      id: entryId,
      state: captureViewState({ view, path: currentPath }),
    });
  };

  /** 文書を差し替え、一覧の開いている文書・帯のタイトル・ページのタイトルを合わせる */
  const showDocument = (path: string): void => {
    const item = payload.docs.find((candidate) => candidate.path === path);
    if (!item) {
      throw new Error(`まとめた文書に無い: ${path}`);
    }
    stopRestore?.();
    stopRestore = undefined;
    handle?.destroy();
    handle = mount(view, {
      markdown: restoreAssets(item.markdown, payload.assets),
      config,
      ...knowledgeOptions(payload, item.docId),
      includes: includesOf(payload, item),
      ...(payload.icons ? { icons: payload.icons } : {}),
    });
    rewriteLinks(view, path, paths);
    currentPath = path;
    markCurrentDoc(doc, path);
    barTitle.textContent = item.title;
    doc.title = item.title;
  };

  /** 文書のタイトルの h1 へ、スクリーンリーダーとキーボードの位置を移す */
  const focusTitle = (preventScroll: boolean): void => {
    const title = view.querySelector<HTMLElement>("h1");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll });
    }
  };

  /** 今の項目のクエリ文字列から map- で始まるキーを消す（履歴に追加しない） */
  const clearMapQuery = (): void => {
    const params = new URLSearchParams(win.location.search);
    for (const key of [...params.keys()]) {
      if (key.startsWith(MAP_QUERY_PREFIX)) params.delete(key);
    }
    const search = params.toString();
    if (search === win.location.search.replace(/^\?/, "")) return;
    win.history.replaceState(
      win.history.state,
      "",
      `${win.location.pathname}${search === "" ? "" : `?${search}`}${win.location.hash}`,
    );
  };

  /** URL の `#` のとおりに文書を出す。移り先の項目に同じ文書の表示の状態を保存していればそれを戻し、無ければ見出しを指していればそこへ、文書だけが替わったときは頭へ移す */
  /** 前に route で出した URL（popstate と hashchange が続けて来たとき、同じ URL を 2 回出さない） */
  let routedHref: string | undefined;
  /** リンクで別の文書へ移るところか（移った先で map のクエリ文字列を消す） */
  let clearOnSwitch = false;
  const route = (initial: boolean): void => {
    const { path, heading, missing } = resolveRoute(
      win.location.hash,
      paths,
      payload.entry,
    );
    // 1 枚に無い文書を指す URL: entry の文書を出し、URL も entry に合わせる（履歴に追加しない）
    if (missing) {
      win.history.replaceState(
        win.history.state,
        "",
        `${DOC_HASH_PREFIX}${payload.entry}`,
      );
    }
    const switched = path !== currentPath;
    if (switched && clearOnSwitch) clearMapQuery();
    clearOnSwitch = false;
    routedHref = win.location.href;
    if (switched) {
      showDocument(path);
    }
    entryId = ensureEntryId(win);
    const saved =
      switched || initial ? readViewState({ win, id: entryId }) : undefined;
    // 戻る・進む・再読み込みで、表示の状態を保存した項目へ戻った: 開閉・タブ・位置を戻し、部品のボタンへ移ったフォーカスを元へ戻してから、戻る・進むでは h1 へ移す（開いた直後は移さない）
    if (saved !== undefined && saved.path === path) {
      stopRestore = applyViewState({ view, state: saved, keepFocus: true });
      if (!initial) {
        focusTitle(true);
      }
      return;
    }
    moveToHeading({ heading, switched, initial });
  };

  /** 見出しを指していればそこへ、文書だけが替わったときは頭へ移し、文書を移ったらタイトルへフォーカスを移す（開いた直後は移さない） */
  const moveToHeading = (options: {
    heading: string | null | undefined;
    switched: boolean;
    initial: boolean;
  }): void => {
    const { heading, switched, initial } = options;
    const target = heading ? doc.getElementById(heading) : null;
    if (target) {
      target.scrollIntoView();
    } else if (switched) {
      win.scrollTo(0, 0);
    }
    // 文書を移ったら、スクリーンリーダーとキーボードの位置を文書のタイトルへ移す（開いた直後は移さない）
    if (switched && !initial) {
      focusTitle(target !== null);
    }
  };

  // 文書を離れる前に、今の項目へ表示の状態を保存する（戻る・進むでは `popstate` の時点で、移り先の項目はまだ描いていない）
  win.addEventListener("popstate", saveViewState);
  win.addEventListener("pagehide", saveViewState);
  doc.addEventListener(
    "click",
    (event) => {
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;
      const href = link?.getAttribute("href");
      if (href?.startsWith(DOC_HASH_PREFIX)) {
        saveViewState();
        // 別の文書へ移るリンク: 移った先の項目のクエリ文字列から map の状態を消す（戻る・進む・再読み込みでは消さない）
        clearOnSwitch =
          resolveRoute(href, paths, payload.entry).path !== currentPath;
      }
    },
    true,
  );
  // スクロールしている間は、間引いて保存する
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  win.addEventListener(
    "scroll",
    () => {
      if (scrollTimer !== undefined) {
        return;
      }
      scrollTimer = setTimeout(() => {
        scrollTimer = undefined;
        saveViewState();
      }, SCROLL_SAVE_INTERVAL_MS);
    },
    { passive: true },
  );
  // 戻る・進むで文書の # の無い項目（開いた直後の entry）へ戻ったときは hashchange が来ないため、popstate で出す
  win.addEventListener("popstate", () => {
    if (!win.location.hash.startsWith(DOC_HASH_PREFIX)) route(false);
  });
  win.addEventListener("hashchange", () => {
    if (win.location.href !== routedHref) route(false);
  });
  // 開いている文書の中の見出しへ移るリンク（見出しのアンカー・目次）は、履歴に追加せず今の項目を置き換える（戻るで文書を行き来できる）
  view.addEventListener("click", (event) => {
    const link =
      event.target instanceof Element ? event.target.closest("a") : null;
    const href = link?.getAttribute("href");
    if (
      href?.startsWith(`${DOC_HASH_PREFIX}${currentPath}#`) &&
      isPlainClick(event)
    ) {
      event.preventDefault();
      win.history.replaceState(win.history.state, "", href);
      route(false);
    }
  });
  route(true);

  // パネルを開き、開いている文書の行へフォーカスを配置する
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
