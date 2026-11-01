import type { PreviewConfig } from "./config.ts";

/** 配色の設定（`mdmark.preview.theme` の値） */
export type PreviewTheme = "auto" | "light" | "dark";

/** 拡張機能から Webview へのメッセージ */
export type HostMessage =
  | {
      type: "render";
      markdown: string;
      /** 差分のパネルだけが持つ、変更前の全文 */
      previous?: string;
      config: PreviewConfig;
      theme: PreviewTheme;
    }
  | { type: "scrollToLine"; line: number }
  | { type: "configError"; line: number }
  | { type: "configOk" }
  | {
      type: "assetsResolved";
      id: number;
      /** 書いたパスから Webview の URL を引く表。見つからないパスは `null` */
      urls: Record<string, string | null>;
    }
  | { type: "inspect"; id: number; selector: string };

/** 調べた要素 1 つの様子（結合テストが Webview の DOM の期待値を確かめるために返す） */
export type InspectedElement = {
  /** 小文字のタグ名 */
  tagName: string;
  /** `class` の値 */
  className: string;
  /** 全ての属性 */
  attributes: Record<string, string>;
  /** `textContent` */
  text: string;
  /** `img` のときだけ */
  naturalWidth?: number;
  /** 見えている範囲の先頭からの位置（px） */
  top: number;
  /** 高さ（px） */
  height: number;
};

/** 配布物を読めない理由 */
export type LoadFailureReason =
  | "offline"
  | "versionMissing"
  | "diffUnsupported";

/** Webview から拡張機能へのメッセージ */
export type WebviewMessage =
  | { type: "ready" }
  | { type: "rendered" }
  | { type: "loadFailed"; reason: LoadFailureReason }
  | { type: "openLink"; href: string }
  | { type: "revealLine"; line: number }
  | { type: "reload" }
  | { type: "openConfig" }
  | { type: "resolveAssets"; id: number; paths: string[] }
  | { type: "openAsset"; path: string }
  | { type: "inspected"; id: number; elements: InspectedElement[] };
