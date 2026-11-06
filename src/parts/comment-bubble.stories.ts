import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CommentBubble" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Single: Story = {
  name: "Single",
  parameters: { server: { id: "comment-bubble" } },
  args: { quote: "テーマの変数", bodies: '["変数の名前を一覧にしてほしい"]' },
};

export const Multiple: Story = {
  name: "Multiple",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies:
      '["変数の名前を一覧にしてほしい","既定の値も並べると、上書きするときに迷わずに済みます。ダークの値も同じ表に並べてください。\\n2 行目の続き"]',
  },
};

export const EscapedBody: Story = {
  name: "EscapedBody",
  parameters: { server: { id: "comment-bubble" } },
  args: { quote: "テーマの変数", bodies: '["ここは <b>太字</b> にしたい"]' },
};

export const Editable: Story = {
  name: "Editable",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies:
      '["ここは <b>太字</b> にしたい","角丸は 6px のままでよいと思います。"]',
    canEdit: "true",
    canRemove: "true",
  },
};

export const RemoveOnly: Story = {
  name: "RemoveOnly",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canRemove: "true",
  },
};

export const Editing: Story = {
  name: "Editing",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies:
      '["ここは <b>太字</b> にしたい","角丸は 6px のままでよいと思います。"]',
    canEdit: "true",
    canRemove: "true",
    editIndex: "0",
    draft: "ここは <b>太字</b> にしたい。見出しも同じにする",
  },
};

export const Updating: Story = {
  name: "Updating",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canEdit: "true",
    editIndex: "0",
    draft: "ここは <b>太字</b> にしたい。見出しも同じにする",
    editState: "saving",
  },
};

export const UpdateEmpty: Story = {
  name: "UpdateEmpty",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canEdit: "true",
    editIndex: "0",
    editState: "empty",
  },
};

export const UpdateFailed: Story = {
  name: "UpdateFailed",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canEdit: "true",
    editIndex: "0",
    draft: "ここは <b>太字</b> にしたい。見出しも同じにする",
    editState: "failed",
  },
};

export const RemoveConfirm: Story = {
  name: "RemoveConfirm",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canEdit: "true",
    canRemove: "true",
    confirmIndex: "0",
  },
};

export const Removing: Story = {
  name: "Removing",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canRemove: "true",
    confirmIndex: "0",
    removeState: "removing",
  },
};

export const RemoveFailed: Story = {
  name: "RemoveFailed",
  parameters: { server: { id: "comment-bubble" } },
  args: {
    quote: "テーマの変数",
    bodies: '["ここは <b>太字</b> にしたい"]',
    canRemove: "true",
    confirmIndex: "0",
    removeState: "failed",
  },
};
