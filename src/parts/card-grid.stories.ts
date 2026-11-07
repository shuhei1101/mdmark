import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CardGrid" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Wide: Story = {
  name: "Wide",
  parameters: { server: { id: "card-grid" } },
  args: {
    items:
      '[{"title":"使い方","href":"使い方/README.md","icon":"book","description":"導入と使い方の手順"},{"title":"リファレンス","href":"リファレンス/README.md","description":"名前から引く一覧"},{"title":"example.com/docs","href":"https://example.com/docs"},{"title":"始める","href":"はじめに/README.md","icon":"rocket"}]',
  },
};

export const NoLink: Story = {
  name: "NoLink",
  parameters: { server: { id: "card-grid" } },
  args: {
    items:
      '[{"title":"準備中","icon":"clock","description":"次の版で追加する"},{"title":"使い方","href":"使い方/README.md","icon":"book","description":"導入と使い方の手順"}]',
  },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "card-grid" } },
  args: {
    items:
      '[{"title":"設定を重ねて読む仕組みと優先の順番","href":"a.md","icon":"book","description":"端末の設定と、文書のフォルダから上のフォルダの設定ファイルを重ねる順・切り替え・相対パスの基準・優先の順番"},{"title":"変更履歴","href":"b.md","description":"版ごとの変更の一覧"},{"title":"始める","href":"c.md","icon":"rocket"}]',
  },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "card-grid" } },
  args: {
    items:
      '[{"title":"使い方","href":"使い方/README.md","icon":"book","description":"導入と使い方の手順"},{"title":"リファレンス","href":"リファレンス/README.md","description":"名前から引く一覧"},{"title":"example.com/docs","href":"https://example.com/docs"},{"title":"始める","href":"はじめに/README.md","icon":"rocket"}]',
    frameWidth: "390px",
  },
};
