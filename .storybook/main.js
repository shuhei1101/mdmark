// 環境変数 `STORYBOOK_ALLOWED_HOSTS` をカンマで区切ったもの（無ければ持たない）
const allowedHosts = process.env.STORYBOOK_ALLOWED_HOSTS?.split(",");

/** Storybook の設定: サーバー描画で、部品のストーリーを YAML から読む */
export default {
  framework: { name: "@storybook/server-webpack5", options: {} },
  stories: ["../src/**/*.stories.yaml", "../vscode/src/**/*.stories.yaml"],
  core: {
    disableTelemetry: true,
    ...(allowedHosts ? { allowedHosts } : {}),
  },
};
