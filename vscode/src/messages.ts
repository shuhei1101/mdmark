import type { MdmarkAlias } from "../../src/knowledge/aliases.ts";
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
      /** 取り込む文書の表（キーは Markdown のフォルダからのパス） */
      includes?: Record<string, string>;
      /** 設定の `aliases` から作ったエイリアス。設定に `aliases` が無いときは持たない */
      aliases?: MdmarkAlias[];
    }
  | { type: "scrollToLine"; line: number }
  | {
      type: "configError";
      /** 読み込めない設定ファイルのパス（表示の構造） */
      path: string;
      /** YAML として読み込めない行（1 始まり）。`settingKey` とどちらか一方 */
      line?: number;
      /** 設定の構造に合わない最初のキー。`line` とどちらか一方 */
      settingKey?: string;
    }
  | { type: "configOk" }
  /** `theme` の CSS の `link` の `href` を替える */
  | { type: "theme"; href: string }
  | {
      type: "assetsResolved";
      id: number;
      /** 記載したパスから Webview の URL を参照する表。見つからないパスは `null` */
      urls: Record<string, string | null>;
    }
  | { type: "inspect"; id: number; selector: string; play?: boolean }
  | { type: "axe"; id: number };

/** 調べた要素 1 つの様子（結合テストが Webview の DOM の期待値を確認するために返却する） */
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
  /** `video`・`audio` のときだけ。`play` を受けたときは、`play()` から 1 秒後の値 */
  currentTime?: number;
  /** `video`・`audio` のときだけ。要素の `readyState`（4 は再生に足りるデータを読み込めた） */
  readyState?: number;
};

/** 結合テストが受け取る axe-core の違反 1 件 */
export type AxeViolation = {
  /** axe-core の規則の ID（`color-contrast` など） */
  id: string;
  /** axe-core の影響度 */
  impact: string | null;
  /** 違反した要素のセレクタ */
  targets: string[];
};

/** 配布物を読み込めない理由 */
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
  | { type: "inspected"; id: number; elements: InspectedElement[] }
  | { type: "axed"; id: number; violations: AxeViolation[] };
