/** `{url}/{id}?{引数}` を取り、200 でなければ状態コードと本文で例外を投げる（既定の取り方は 404 の本文もストーリーに出す） */
async function fetchStoryHtml(url, path, params) {
  const response = await fetch(`${url}/${path}?${new URLSearchParams(params)}`);
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  return response.text();
}

// 全ストーリーに共通の引数: 部品の HTML を描画の口（Storybook の開発サーバーの `/render`）から取る
export const parameters = {
  server: {
    url: `${window.location.origin}/render`,
    fetchStoryHtml,
  },
};
