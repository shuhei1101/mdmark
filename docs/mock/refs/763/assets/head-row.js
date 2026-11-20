// #763 のモック: テーブル名の行を 1 行（種類の行を持たない）にした寸法で map の図を描くため、
// 配布物の dist/map.js の ER 図とクラス図の見出しの高さ（56px）を 36px に置き換えた写しを import map で読ませる。
// 線の端・列の行の位置は寸法から計算されるので、見出しの高さに合わせて動く。
const HEAD = 36;
export async function useOneRowHead() {
  const url = new URL("../../../../../dist/map.js", import.meta.url).href;
  const source = await (await fetch(url)).text();
  const patched = source
    .replace(/head:56,row:28,foot:6,aside:32/, `head:${HEAD},row:28,foot:6,aside:32`)
    .replace(/head:56,row:22,line:16/, `head:${HEAD},row:22,line:16`);
  if (patched === source) throw new Error("dist/map.js の見出しの高さが見つかりません（配布物が変わった）");
  const blob = URL.createObjectURL(new Blob([patched], { type: "text/javascript" }));
  const map = document.createElement("script");
  map.type = "importmap";
  map.textContent = JSON.stringify({ imports: { [url]: blob } });
  document.head.append(map);
}
