import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { HostMessage } from "../../../../messages.ts";
import { createFakeVsCodeApi } from "../../../testing/fake-vscode-api.ts";
import { type DistHeadKind, handlers } from "../../../testing/msw/handlers.ts";
import type { Mdmark } from "./load-mdmark.ts";
import { loadMdmark } from "./load-mdmark.ts";
import { PanelScreen } from "./panel-screen.tsx";

/** このブランチの配布物（Storybook の `staticDirs` が配る） */
const LOCAL_DIST_JS = "/mdmark-dist/index.js";
/** 読めない配布物の URL（MSW の HEAD のハンドラが当たる） */
const JSDELIVR_DIST_JS =
  "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.7.0/dist/index.js";

/** 見本の文書 */
const SAMPLE_MARKDOWN = `# リリースの手順

## 確かめる項目

| 項目 | 確かめ方 | 担当 |
| --- | --- | --- |
| 変更履歴 | 版ごとの節がある | 作者 |
| 配布物 | サイズの検査が通る | CI |

> [!WARNING]
> タグを打つ前に変更履歴を確かめる。

## 手順

1. 変更履歴を書く
2. タグを打つ
`;

/** パネルのストーリーの引数 */
type PanelStoryArgs = {
  /** 読む配布物の URL。無ければバージョンを決められない */
  distJs?: string;
  /** 読むバージョン */
  version?: string;
  /** 配布物を読む関数 */
  load: (url: string) => Promise<Mdmark>;
  /** `ready` を受けた後に送る拡張機能のメッセージ */
  messages: HostMessage[];
};

/** `#mdmark-preview` を置き、その中にプレビューの画面を描く */
const PanelStory = ({ distJs, version, load, messages }: PanelStoryArgs) => {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [api] = useState(() =>
    createFakeVsCodeApi({
      onPost: (message) => {
        if (message.type === "ready") {
          for (const host of messages) {
            window.postMessage(host, "*");
          }
        }
      },
    }),
  );
  return (
    <div id="mdmark-preview" ref={setRoot}>
      {root !== null && (
        <PanelScreen
          boot={{
            root,
            distJs,
            version,
            status: undefined,
            configPath: "mdmark.config.yaml",
            test: false,
          }}
          api={api}
          load={load}
        />
      )}
    </div>
  );
};

/** `render` のメッセージ */
const renderOf = (markdown: string, previous?: string): HostMessage => ({
  type: "render",
  markdown,
  ...(previous === undefined ? {} : { previous }),
  config: {},
  theme: "auto",
});

/** MSW の HEAD のハンドラ */
const msw = (kind: DistHeadKind) => ({ msw: { handlers: handlers(kind) } });

const meta = {
  title: "VSCode/PanelScreen",
  render: (args) => <PanelStory {...args} />,
  args: {
    distJs: LOCAL_DIST_JS,
    version: "v0.7.0",
    load: loadMdmark,
    messages: [renderOf(SAMPLE_MARKDOWN)],
  },
} satisfies Meta<PanelStoryArgs>;
export default meta;

/** ストーリー: 画面設計『VSCodeのプレビュー』の場面 */
type Story = StoryObj<typeof meta>;

export const Document: Story = { name: "Document" };

export const Loading: Story = {
  name: "Loading",
  args: { load: () => new Promise<never>(() => undefined) },
};

export const Offline: Story = {
  name: "Offline",
  args: {
    distJs: JSDELIVR_DIST_JS,
    load: () => Promise.reject(new TypeError("Failed to fetch")),
  },
  parameters: msw("offline"),
};

export const VersionMissing: Story = {
  name: "VersionMissing",
  args: {
    distJs: JSDELIVR_DIST_JS.replace("v0.7.0", "v9.9.9"),
    version: "v9.9.9",
    load: () => Promise.reject(new TypeError("Failed to fetch")),
  },
  parameters: msw("versionMissing"),
};

export const VersionUndecidable: Story = {
  name: "VersionUndecidable",
  args: { distJs: undefined, version: undefined },
};

export const DiffUnsupported: Story = {
  name: "DiffUnsupported",
  args: {
    version: "v0.8.0",
    load: async () => ({
      mount: () => ({ update: () => undefined, destroy: () => undefined }),
    }),
    messages: [renderOf("A2", "A1")],
  },
};

export const ConfigError: Story = {
  name: "ConfigError",
  args: {
    messages: [renderOf(SAMPLE_MARKDOWN), { type: "configError", line: 4 }],
  },
};

export const MediaError: Story = {
  name: "MediaError",
  args: {
    messages: [renderOf(`${SAMPLE_MARKDOWN}\n![操作の動画](media/demo.mov)\n`)],
  },
};
