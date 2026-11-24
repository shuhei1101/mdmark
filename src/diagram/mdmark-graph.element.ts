import { resolveConfig } from "../config.ts";
import { render } from "../render/index.ts";
import { renderNotice } from "../shared/notice.part.ts";
import {
  type DiagramDirective,
  type MdmarkChartDefinition,
  type MdmarkParamDefinition,
  readDefinition,
} from "./definition.ts";
import { attachDiagrams } from "./diagram.interact.ts";
import { attachParams } from "./param.interact.ts";

/** 値の変更のイベントの値 */
export type MdmarkParamChangeDetail = {
  /** 動かしたスライダーの `knob.key` */
  key: string;
  /** スライダーの今の値 */
  value: number;
};

/** グラフのカスタム要素の名前 */
export const GRAPH_ELEMENT_NAME = "mdmark-graph";

/** 操作できる部品のカスタム要素の名前 */
export const PARAM_GRAPH_ELEMENT_NAME = "mdmark-param-graph";

/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

/** 部品の定義を `directive` のマーカーの範囲の Markdown にする */
const directiveMarkdown = (directive: DiagramDirective, json: string): string =>
  [
    `<!-- ${directive} -->`,
    "",
    "```json",
    json,
    "```",
    "",
    `<!-- /${directive} -->`,
    "",
  ].join("\n");

/** 部品の定義を代入すると、次のマイクロタスクで図の部品か通知ブロックを描くカスタム要素の共通の処理 */
abstract class DiagramElement<Definition> extends BaseElement {
  #definition: Definition | undefined;
  #pending = false;
  #detach: (() => void) | undefined;

  /** 描く図の部品のマーカーの名前 */
  protected abstract readonly directive: DiagramDirective;

  /** 部品の定義 */
  get definition(): Definition | undefined {
    return this.#definition;
  }

  set definition(value: Definition | undefined) {
    this.#definition = value;
    this.scheduleRender();
  }

  /** 登録する前に代入されていた定義を取り出してアクセサーへ設定し、描画を予約する */
  connectedCallback(): void {
    if (Object.hasOwn(this, "definition")) {
      const value: unknown = (this as Record<string, unknown>).definition;
      delete (this as Record<string, unknown>).definition;
      (this as Record<string, unknown>).definition = value;
    }
    this.scheduleRender();
  }

  /** 図の枠の操作を解除する（中身とプロパティは残す） */
  disconnectedCallback(): void {
    this.#detach?.();
    this.#detach = undefined;
  }

  /** 描画を次のマイクロタスクに 1 回だけ予約する */
  scheduleRender(): void {
    if (this.#pending) {
      return;
    }
    this.#pending = true;
    queueMicrotask(() => this.renderNow());
  }

  /** 定義を確認し、誤りがあれば通知ブロックを、無ければ図の枠と図の部品を描く */
  renderNow(): void {
    this.#pending = false;
    if (!this.isConnected || this.#definition === undefined) {
      return;
    }
    const json = JSON.stringify(this.#definition) ?? "";
    const result = readDefinition(this.directive, [json]);
    if (!result.ok) {
      this.#detach?.();
      this.#detach = undefined;
      this.replaceChildren(
        this.#container(
          renderNotice({
            name: "definition",
            source: "data",
            reason: `を読み込めません。${result.problems[0] ?? ""}`,
          }),
        ),
      );
      return;
    }
    const height = this.querySelector<HTMLElement>(".mdmark-diagram-viewport")
      ?.style.height;
    this.#detach?.();
    const root = this.#container(
      render(directiveMarkdown(this.directive, json)),
    );
    this.replaceChildren(root);
    const detachers = [
      attachDiagrams({
        root,
        placement: resolveConfig({}).tooltips.diagramPlacement,
      }),
      this.attachPart(root, result.definition as Definition),
    ];
    const viewport = root.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    if (viewport && height) {
      viewport.style.height = height;
    }
    this.#detach = () => {
      for (const detach of detachers.reverse()) {
        detach();
      }
    };
  }

  /** 図の部品に固有の操作を付け、解除する関数を返却する */
  protected attachPart(
    _root: HTMLElement,
    _definition: Definition,
  ): () => void {
    return () => {};
  }

  /** class `mdmark` の要素に HTML を入れて返却する */
  #container(html: string): HTMLElement {
    const root = document.createElement("div");
    root.className = "mdmark";
    root.innerHTML = html;
    return root;
  }
}

/** グラフの定義を代入すると、`chart` のマーカーの範囲と同じ図の枠とグラフか通知ブロックを描くカスタム要素 */
export class MdmarkGraphElement extends DiagramElement<MdmarkChartDefinition> {
  protected readonly directive = "chart";
}

/** 操作できる部品の定義を代入すると、`param` のマーカーの範囲と同じスライダーとグラフを描き、値の変更を `mdmark-param-change` で送信するカスタム要素 */
export class MdmarkParamGraphElement extends DiagramElement<MdmarkParamDefinition> {
  protected readonly directive = "param";

  protected override attachPart(
    root: HTMLElement,
    definition: MdmarkParamDefinition,
  ): () => void {
    return attachParams(root, [definition], {
      onChange: (key, value) => {
        this.dispatchEvent(
          new CustomEvent<MdmarkParamChangeDetail>("mdmark-param-change", {
            detail: { key, value },
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
  }
}

/** 登録先に `mdmark-graph`・`mdmark-param-graph` が登録されていなければ、それぞれ登録する */
export const defineGraphElements = (registry: CustomElementRegistry): void => {
  if (registry.get(GRAPH_ELEMENT_NAME) === undefined) {
    registry.define(GRAPH_ELEMENT_NAME, MdmarkGraphElement);
  }
  if (registry.get(PARAM_GRAPH_ELEMENT_NAME) === undefined) {
    registry.define(PARAM_GRAPH_ELEMENT_NAME, MdmarkParamGraphElement);
  }
};
