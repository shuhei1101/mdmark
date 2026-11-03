// コメントの修正・削除のモック: [data-mock-edit] の吹き出しの「編集」「削除」を押すと、入力欄・削除の確認に切り替える。
// 保存先は持たず、保存・削除したことにして表示を変える。[data-mock-edit="error"] では保存と削除が失敗する

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 保存・削除にかかる時間（モックの仮の待ち。処理している間の表示を見せる）
  const WAIT_MS = 600;
  // 誤りのアイコン（24 の格子。lucide の形）
  const ALERT_ICON =
    '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';

  /** 待ってから結果を返す。 */
  const wait = (fails) => new Promise((resolve) => setTimeout(() => resolve(!fails), WAIT_MS));

  /** 誤りの知らせの要素を返す。 */
  const errorOf = (id, text) => {
    const p = document.createElement("p");
    p.className = "mdmark-comment-error";
    p.id = id;
    p.setAttribute("role", "alert");
    p.innerHTML = `${ALERT_ICON}<span></span>`;
    p.querySelector("span").textContent = text;
    return p;
  };

  /** 1 件のコメントを、本文と「編集」「削除」の表示に戻す。 */
  const renderView = (item, body) => {
    item.dataset.body = body;
    item.innerHTML = `<p class="mdmark-comment-body"></p>
      <div class="mdmark-comment-item-actions">
        <button class="mdmark-comment-text-button" type="button" data-action="edit">編集</button>
        <button class="mdmark-comment-text-button" type="button" data-action="remove">削除</button>
      </div>`;
    item.querySelector(".mdmark-comment-body").textContent = body;
  };

  /** 1 件のコメントを、本文を入れた入力欄に切り替える。 */
  const renderForm = (item) => {
    const errorId = `${item.id}-error`;
    item.innerHTML = `<form>
        <label class="mdmark-comment-field">コメント<textarea rows="3"></textarea></label>
        <div class="mdmark-comment-actions">
          <button class="mdmark-comment-button" type="button" data-action="cancel">キャンセル</button>
          <button class="mdmark-comment-button is-primary" type="submit">保存</button>
        </div>
      </form>`;
    const textarea = item.querySelector("textarea");
    textarea.value = item.dataset.body;
    textarea.setAttribute("aria-describedby", errorId);
    textarea.focus();
  };

  /** 1 件のコメントの下に、削除の確認を出す。 */
  const renderConfirm = (item) => {
    renderView(item, item.dataset.body);
    item.querySelector(".mdmark-comment-item-actions").remove();
    const confirm = document.createElement("div");
    confirm.className = "mdmark-comment-confirm";
    confirm.innerHTML = `<p>このコメントを削除しますか? 削除すると元に戻せません。</p>
      <div class="mdmark-comment-actions">
        <button class="mdmark-comment-button" type="button" data-action="cancel">キャンセル</button>
        <button class="mdmark-comment-button is-danger" type="button" data-action="confirm-remove">削除</button>
      </div>`;
    item.append(confirm);
    confirm.querySelector('[data-action="cancel"]').focus();
  };

  for (const bubble of document.querySelectorAll("[data-mock-edit]")) {
    const fails = bubble.dataset.mockEdit === "error";

    bubble.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const item = button.closest(".mdmark-comment-item");
      const action = button.dataset.action;
      // 押したボタンごとに表示を切り替える
      if (action === "edit") renderForm(item);
      if (action === "remove") renderConfirm(item);
      if (action === "cancel") {
        renderView(item, item.dataset.body);
        item.querySelector('[data-action="edit"]').focus();
      }
      if (action === "confirm-remove") {
        button.disabled = true;
        button.textContent = "削除しています…";
        item.querySelector(".mdmark-comment-error")?.remove();
        if (await wait(fails)) {
          item.remove();
          return;
        }
        button.disabled = false;
        button.textContent = "削除";
        item.querySelector(".mdmark-comment-confirm").before(errorOf(`${item.id}-error`, "コメントを削除できませんでした。もう一度お試しください。"));
      }
    });

    bubble.addEventListener("submit", async (event) => {
      event.preventDefault();
      const item = event.target.closest(".mdmark-comment-item");
      const textarea = item.querySelector("textarea");
      const save = item.querySelector('button[type="submit"]');
      save.disabled = true;
      save.textContent = "保存しています…";
      item.querySelector(".mdmark-comment-error")?.remove();
      textarea.removeAttribute("aria-invalid");
      if (await wait(fails)) {
        renderView(item, textarea.value);
        return;
      }
      save.disabled = false;
      save.textContent = "保存";
      textarea.setAttribute("aria-invalid", "true");
      item
        .querySelector(".mdmark-comment-field")
        .after(errorOf(`${item.id}-error`, "コメントを保存できませんでした。書いたコメントは残っています。もう一度「保存」を押してください。"));
    });
  }
}
