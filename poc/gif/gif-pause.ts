/** GIF の img の上に、最初のフレームを描いた canvas を重ね、ボタンで img と canvas を切り替える（案 A） */
export async function attachGifPause(
  img: HTMLImageElement,
): Promise<HTMLButtonElement> {
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.className = "gif-still";
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2d のコンテキストを取れない");
  }
  context.drawImage(img, 0, 0);
  canvas.hidden = true;
  img.after(canvas);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "停止";
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const paused = canvas.hidden;
    canvas.hidden = !paused;
    img.style.visibility = paused ? "hidden" : "";
    button.textContent = paused ? "再生" : "停止";
    button.setAttribute("aria-pressed", String(paused));
  });
  canvas.after(button);
  return button;
}

for (const img of document.querySelectorAll<HTMLImageElement>(
  "img[data-gif]",
)) {
  void attachGifPause(img);
}
