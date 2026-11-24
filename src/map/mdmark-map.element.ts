import { resolveConfig } from "../config.ts";
import { loadPartModule } from "../part-modules.ts";
import { collectWarnings, render } from "../render/index.ts";
import { renderNotice } from "../shared/notice.part.ts";

/** ノードの押下のイベントの値 */
export type MdmarkNodeClickDetail = {
  /** 押したノードの Mermaid の ID */
  id: string;
};

/** map の設定 */
export type MdmarkMapOptions = {
  /** 図のタイトル */
  title?: string;
  /** 描いた直後に強調するノード */
  focus?: string;
};

/** カスタム要素の名前 */
export const MAP_ELEMENT_NAME = "mdmark-map";

/** 代入を受け取るプロパティ */
const PROPERTIES = ["source", "data", "options"] as const;

/** `options` が受け付けるキー */
const OPTION_KEYS: readonly string[] = ["title", "focus"];

/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

/** 指定の誤り */
type MapIssue = { name: string; reason: string };

/** HTML コメントの中に埋める JSON。`-->` で閉じないよう、`-` を全て JSON の Unicode エスケープにする */
const commentJson = (value: unknown): string =>
  (JSON.stringify(value) ?? "").replaceAll("-", "\\u002d");

/** `source` を、中の最も長い ``` の連続より 1 つ長いフェンスのコードブロックにする */
const fencedMermaid = (source: string): string => {
  const longest = Math.max(
    0,
    ...[...source.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}mermaid\n${source}${source.endsWith("\n") ? "" : "\n"}${fence}`;
};

/** map の範囲の Markdown を組み立てる */
const mapMarkdown = (options: {
  source: string;
  data: unknown;
  settings: MdmarkMapOptions | undefined;
}): string => {
  const { source, data, settings } = options;
  const open =
    settings === undefined
      ? "<!-- map -->"
      : `<!-- map: ${commentJson(settings)} -->`;
  const supplement =
    data === undefined ? "" : `\n<!-- map-data: ${commentJson(data)} -->\n`;
  return `${open}\n\n${fencedMermaid(source)}\n${supplement}\n<!-- /map -->\n`;
};

/** `source`・`options` を確かめ、誤りがあれば最初の 1 つを返却する */
const checkSpec = (source: unknown, options: unknown): MapIssue | undefined => {
  if (typeof source !== "string") {
    return {
      name: "source",
      reason: "は Mermaid の文字列で指定してください。",
    };
  }
  if (options === undefined) {
    return undefined;
  }
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    return {
      name: "options",
      reason: "は title・focus を持つオブジェクトで指定してください。",
    };
  }
  const unknownKey = Object.keys(options).find(
    (key) => !OPTION_KEYS.includes(key),
  );
  if (unknownKey !== undefined) {
    return {
      name: `options.${unknownKey}`,
      reason: "は指定できません。title・focus だけを指定してください。",
    };
  }
  return undefined;
};

/** Mermaid と補足を代入すると、次のマイクロタスクで map の範囲と同じ図か通知ブロックを描き、ノードの押下を `mdmark-node-click` で送信するカスタム要素 */
export class MdmarkMapElement extends BaseElement {
  #source: string | undefined;
  #data: object | undefined;
  #options: MdmarkMapOptions | undefined;
  #pending = false;
  #detach: (() => void) | undefined;
  /** 描画の番号。部品のモジュールを待つ間に次の描画が始まったら、前の描画をやめる */
  #renders = 0;

  /** Mermaid */
  get source(): string | undefined {
    return this.#source;
  }

  set source(value: string | undefined) {
    this.#source = value;
    this.scheduleRender();
  }

  /** 補足 */
  get data(): object | undefined {
    return this.#data;
  }

  set data(value: object | undefined) {
    this.#data = value;
    this.scheduleRender();
  }

  /** map の設定 */
  get options(): MdmarkMapOptions | undefined {
    return this.#options;
  }

  set options(value: MdmarkMapOptions | undefined) {
    this.#options = value;
    this.scheduleRender();
  }

  /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、描画を予約する */
  connectedCallback(): void {
    for (const name of PROPERTIES) {
      if (Object.hasOwn(this, name)) {
        const value: unknown = (this as Record<string, unknown>)[name];
        delete (this as Record<string, unknown>)[name];
        (this as Record<string, unknown>)[name] = value;
      }
    }
    this.scheduleRender();
  }

  /** `document` の受け取りを解除する（プロパティは残し、ページへ戻すと描き直す） */
  disconnectedCallback(): void {
    this.#renders += 1;
    this.#detach?.();
    this.#detach = undefined;
  }

  /** 描画を次のマイクロタスクに 1 回だけ予約する */
  scheduleRender(): void {
    if (this.#pending) {
      return;
    }
    this.#pending = true;
    queueMicrotask(() => {
      void this.renderNow();
    });
  }

  /** 指定を確認し、map の範囲の Markdown を `render` して `attachMap` で図にする */
  async renderNow(): Promise<void> {
    this.#pending = false;
    if (!this.isConnected || this.#source === undefined) {
      return;
    }
    this.#renders += 1;
    const renderId = this.#renders;
    const markdown = this.#markdownOrNotice(this.#source);
    if (markdown === undefined) {
      return;
    }
    let module: Awaited<ReturnType<typeof loadPartModule<"map">>>["module"];
    try {
      ({ module } = await loadPartModule("map"));
    } catch {
      this.#detach?.();
      this.#detach = undefined;
      this.replaceChildren(
        this.#container(renderNotice({ name: "map", source: "part" })),
      );
      return;
    }
    if (renderId !== this.#renders || !this.isConnected) {
      return;
    }
    this.#detach?.();
    const root = this.#container(render(markdown));
    this.replaceChildren(root);
    this.#detach = module.attachMap(root, resolveConfig({}), {
      onNodeClick: (id) => {
        this.dispatchEvent(
          new CustomEvent<MdmarkNodeClickDetail>("mdmark-node-click", {
            detail: { id },
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
  }

  /** 指定を確認して map の範囲の Markdown を返却する。誤りがあれば通知ブロックにして `undefined` を返却する */
  #markdownOrNotice(source: string): string | undefined {
    const issue = checkSpec(source, this.#options);
    if (issue) {
      this.#showNotice(issue);
      return undefined;
    }
    const markdown = mapMarkdown({
      source,
      data: this.#data,
      settings: this.#options,
    });
    const warning = collectWarnings(markdown)[0];
    if (warning) {
      this.#showNotice({
        name: /補足/.test(warning.message) ? "data" : "source",
        reason: `を読み込めません。${warning.message}`,
      });
      return undefined;
    }
    return markdown;
  }

  /** 要素の中を、指定の誤りの通知ブロックにする */
  #showNotice(issue: MapIssue): void {
    this.#detach?.();
    this.#detach = undefined;
    this.replaceChildren(
      this.#container(
        renderNotice({
          name: issue.name,
          source: "data",
          reason: issue.reason,
        }),
      ),
    );
  }

  /** class `mdmark` の要素に HTML を入れて返却する */
  #container(html: string): HTMLElement {
    const root = document.createElement("div");
    root.className = "mdmark";
    root.innerHTML = html;
    return root;
  }
}

/** 登録先に `mdmark-map` が登録されていなければ `MdmarkMapElement` を登録する */
export const defineMapElement = (registry: CustomElementRegistry): void => {
  if (registry.get(MAP_ELEMENT_NAME) === undefined) {
    registry.define(MAP_ELEMENT_NAME, MdmarkMapElement);
  }
};
