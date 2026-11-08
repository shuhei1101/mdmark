import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DocList" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Grouped: Story = {
  name: "Grouped",
  parameters: { server: { id: "doc-list" } },
  args: {
    docs: '[{"path":"README.md","title":"mdmark の文書"},{"path":"使い方/guide.md","title":"使用方法"},{"path":"使い方/導入/配布物を読み込む.md","title":"配布物を読み込む"},{"path":"使い方/導入/文書を描く.md","title":"文書を描く"},{"path":"リファレンス/api.md","title":"API"}]',
    current: "使い方/guide.md",
  },
};

export const Flat: Story = {
  name: "Flat",
  parameters: { server: { id: "doc-list" } },
  args: {
    docs: '[{"path":"intro.md","title":"はじめに"},{"path":"steps.md","title":"手順"},{"path":"faq.md","title":"よくある質問"}]',
    current: "intro.md",
  },
};

export const LongText: Story = {
  name: "LongText",
  parameters: { server: { id: "doc-list" } },
  args: {
    docs: '[{"path":"使用方法/カスタマイズ/テーマ/層の外の CSS/load.md","title":"バージョンを固定した URL で JavaScript と CSS を読み込み、要素に文書を描くまで"}]',
    current: "使用方法/カスタマイズ/テーマ/層の外の CSS/load.md",
  },
};

export const Many: Story = {
  name: "Many",
  parameters: { server: { id: "doc-list" } },
  args: {
    docs: '[{"path":"README.md","title":"mdmark の文書"},{"path":"はじめに/概要.md","title":"概要"},{"path":"はじめに/仕組み.md","title":"文書を描く仕組み"},{"path":"はじめに/変更履歴.md","title":"変更履歴"},{"path":"使い方/書く/表.md","title":"表に機能を付ける"},{"path":"使い方/書く/部品.md","title":"本文を部品で組む"},{"path":"使い方/書く/図.md","title":"図と表に番号を付ける"},{"path":"使い方/カスタマイズ/テーマ.md","title":"テーマを上書きする"},{"path":"使い方/カスタマイズ/機能.md","title":"機能をオン・オフする"},{"path":"使い方/書き出す/雛形.md","title":"雛形を配置する"},{"path":"使い方/書き出す/書き出す.md","title":"文書を書き出す"},{"path":"リファレンス/api.md","title":"API"},{"path":"リファレンス/cli.md","title":"CLI"},{"path":"リファレンス/設定.md","title":"設定"}]',
    current: "使い方/書く/部品.md",
  },
};
