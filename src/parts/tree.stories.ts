import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/FileTree" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Basic: Story = {
  name: "Basic",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"mdmark/","children":[{"name":"src/","children":[{"name":"index.ts"}]},{"name":"package.json"}]}]',
    source: "mdmark/\n├── src/\n│   └── index.ts\n└── package.json",
  },
};

export const Interactive: Story = {
  name: "Interactive",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"mdmark/","children":[{"name":"src/","children":[{"name":"index.ts"}]},{"name":"package.json"}]}]',
    source: "mdmark/\n├── src/\n│   └── index.ts\n└── package.json",
    interactive: true,
  },
};

export const OpenAll: Story = {
  name: "OpenAll",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"app/","children":[{"name":"src/","children":[{"name":"parts/","children":[{"name":"tree.ts"}]}]}]}]',
    source: "app/\n└── src/\n    └── parts/\n        └── tree.ts",
    open: "all",
    interactive: true,
  },
};

export const OpenLevels: Story = {
  name: "OpenLevels",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"app/","children":[{"name":"src/","children":[{"name":"parts/","children":[{"name":"tree.ts"}]}]}]}]',
    source: "app/\n└── src/\n    └── parts/\n        └── tree.ts",
    open: 2,
    interactive: true,
  },
};

export const OpenRoot: Story = {
  name: "OpenRoot",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"app/","children":[{"name":"src/","children":[{"name":"parts/","children":[{"name":"tree.ts"}]}]}]}]',
    source: "app/\n└── src/\n    └── parts/\n        └── tree.ts",
    open: 1,
    interactive: true,
  },
};

export const Notes: Story = {
  name: "Notes",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"mdmark/","children":[{"name":"src/","note":"ソース","children":[{"name":"index.ts","note":"入口の <code>mount</code>"}]},{"name":"README.md","note":"<strong>必読</strong> <span class=\\"mdmark-badge\\">新規</span>"}]}]',
    source:
      "mdmark/\n├── src/ # ソース\n│   └── index.ts # 入口の `mount`\n└── README.md # **必読** `badge:新規`",
    open: "all",
    interactive: true,
  },
};

export const FileIcons: Story = {
  name: "FileIcons",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"files/","children":[{"name":"README.md"},{"name":"index.ts"},{"name":"package.json"},{"name":"photo.PNG"},{"name":"data.csv"},{"name":"dist.zip"},{"name":"Dockerfile"},{"name":"font.woff2"}]}]',
    source:
      "files/\n├── README.md\n├── index.ts\n├── package.json\n├── photo.PNG\n├── data.csv\n├── dist.zip\n├── Dockerfile\n└── font.woff2",
    interactive: true,
  },
};

export const More: Story = {
  name: "More",
  parameters: { server: { id: "tree" } },
  args: {
    nodes: '[{"name":"src/","children":[{"name":"index.ts"},{"name":"..."}]}]',
    source: "src/\n├── index.ts\n└── ...",
    interactive: true,
  },
};

export const Deep: Story = {
  name: "Deep",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"a/","children":[{"name":"b/","children":[{"name":"c/","children":[{"name":"d/","children":[{"name":"e.ts"}]}]}]}]}]',
    source: "a/\n└── b/\n    └── c/\n        └── d/\n            └── e.ts",
    open: "all",
    interactive: true,
  },
};

export const LongName: Story = {
  name: "LongName",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"src/","children":[{"name":"a-very-long-file-name-that-does-not-fit-in-the-width-of-the-document.ts","note":"とても長い注釈で、文書の幅を超えて何行かに折り返すときに、名前と注釈の列がずれないことを確認する"}]}]',
    source:
      "src/\n└── a-very-long-file-name-that-does-not-fit-in-the-width-of-the-document.ts # とても長い注釈で、文書の幅を超えて何行かに折り返すときに、名前と注釈の列がずれないことを確認する",
    open: "all",
    interactive: true,
  },
};

export const Copied: Story = {
  name: "Copied",
  parameters: { server: { id: "tree" } },
  args: {
    nodes: '[{"name":"src/","children":[{"name":"index.ts"}]}]',
    source: "src/\n└── index.ts",
    interactive: true,
    copyState: "copied",
  },
};

export const CopyFailed: Story = {
  name: "CopyFailed",
  parameters: { server: { id: "tree" } },
  args: {
    nodes: '[{"name":"src/","children":[{"name":"index.ts"}]}]',
    source: "src/\n└── index.ts",
    interactive: true,
    copyFallback: true,
  },
};

export const Wrap: Story = {
  name: "Wrap",
  parameters: { server: { id: "tree" } },
  args: {
    nodes:
      '[{"name":"very-long-folder-name-for-the-generated-design-documents/","children":[{"name":"a-file-name-that-is-much-longer-than-the-box-width-on-phones.config.ts","note":"狭い幅では注釈も項目の中で折り返す"}]}]',
    source:
      "very-long-folder-name-for-the-generated-design-documents/\n└── a-file-name-that-is-much-longer-than-the-box-width-on-phones.config.ts # 狭い幅では注釈も項目の中で折り返す",
    open: "all",
    interactive: true,
    wrap: true,
  },
};
