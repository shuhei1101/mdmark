import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/RevisionPicker" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Normal: Story = {
  name: "Normal",
  parameters: { server: { id: "revision-picker" } },
  args: {
    revisions:
      '[{"id":"r3","at":"2026-10-20T02:05:00Z","label":"見出しを書き換える","author":"田中"},{"id":"r2","at":"2026-10-19T07:40:00Z","label":"件数を修正する","author":"鈴木"},{"id":"r1","at":"2026-10-18T00:12:00Z","label":"初版","author":"佐藤"}]',
    before: "r2",
    after: "r3",
    counts: '{"del":1,"add":8}',
  },
};

export const BeforeSelected: Story = {
  name: "BeforeSelected",
  parameters: { server: { id: "revision-picker" } },
  args: {
    revisions:
      '[{"id":"r3","at":"2026-10-20T02:05:00Z","label":"見出しを書き換える","author":"田中"},{"id":"r2","at":"2026-10-19T07:40:00Z","label":"件数を修正する","author":"鈴木"},{"id":"r1","at":"2026-10-18T00:12:00Z","label":"初版","author":"佐藤"}]',
    before: "r2",
    after: "r3",
  },
};

export const Sparse: Story = {
  name: "Sparse",
  parameters: { server: { id: "revision-picker" } },
  args: {
    revisions:
      '[{"id":"b2","at":"2026-10-20T02:05:00Z","label":"問い合わせ窓口の週の報告の件数を全ての窓口でもう一度数え、返却方法のセクションを追記する","author":"問い合わせ窓口の運用担当のとても長い名前"},{"id":"b1","at":"2026-10-18T00:12:00Z"}]',
    before: "b1",
    after: "b2",
  },
};
