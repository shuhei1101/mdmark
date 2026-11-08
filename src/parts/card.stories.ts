import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Card" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Link: Story = {
  name: "Link",
  parameters: { server: { id: "card" } },
  args: {
    kind: "link",
    href: "https://github.com/shuhei1101/mdmark",
    title: "mdmark のリポジトリ",
  },
};

export const BareUrl: Story = {
  name: "BareUrl",
  parameters: { server: { id: "card" } },
  args: {
    kind: "link",
    href: "https://www.jsdelivr.com/package/gh/shuhei1101/mdmark",
    title: "www.jsdelivr.com/package/gh/shuhei1101/mdmark",
  },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "card" } },
  args: {
    kind: "link",
    href: "https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%96%87%E6%9B%B8%E3%82%92%E6%8F%8F%E3%81%8F.yaml",
    title:
      "単一ユースケース「使う側のページが要素と Markdown を渡して文書を描き、本文の差し替えと片付けをする」のシナリオ",
  },
};

export const FilePdf: Story = {
  name: "FilePdf",
  parameters: { server: { id: "card" } },
  args: {
    kind: "file",
    href: "./files/design.pdf",
    title: "設計の資料",
    fileKind: "pdf",
  },
};

export const FileSheet: Story = {
  name: "FileSheet",
  parameters: { server: { id: "card" } },
  args: {
    kind: "file",
    href: "./files/estimate.xlsx",
    title: "見積もり",
    fileKind: "sheet",
  },
};

export const FileArchive: Story = {
  name: "FileArchive",
  parameters: { server: { id: "card" } },
  args: {
    kind: "file",
    href: "./files/samples.zip",
    title: "samples.zip",
    fileKind: "archive",
  },
};

export const FileSlide: Story = {
  name: "FileSlide",
  parameters: { server: { id: "card" } },
  args: {
    kind: "file",
    href: "./files/notes.key",
    title: "発表の原稿",
    fileKind: "slide",
  },
};

export const Print: Story = {
  name: "Print",
  parameters: { server: { id: "card" } },
  args: {
    kind: "link",
    href: "https://github.com/shuhei1101/mdmark",
    title: "mdmark のリポジトリ",
  },
};
