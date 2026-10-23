import { expect, test } from "vitest";

/** タグの照合を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../vscode/scripts/release-check.ts");

// タグのバージョンと version が等しい（正常系）
test("test_check_release_tag", async () => {
  // 準備
  const { checkReleaseTag } = await loadCheck();
  // 実行
  const result = checkReleaseTag({ tag: "vscode-v0.1.0", version: "0.1.0" });
  // 検証
  expect(result).toEqual({ ok: true });
});

// バージョンが違うときは 2 つのバージョンを出す（正常系）
test("test_check_release_tag_when_mismatch", async () => {
  // 準備
  const { checkReleaseTag } = await loadCheck();
  // 実行
  const result = checkReleaseTag({ tag: "vscode-v0.2.0", version: "0.1.0" });
  // 検証
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.message).toContain("0.2.0");
    expect(result.message).toContain("0.1.0");
  }
});

// 形に合わないタグは合わないときと同じく止める（正常系）
test("test_check_release_tag_when_invalid_tag", async () => {
  // 準備
  const { checkReleaseTag } = await loadCheck();
  const tags = ["v0.1.0", "vscode-0.1.0"];
  // 実行
  const results = tags.map((tag) => checkReleaseTag({ tag, version: "0.1.0" }));
  // 検証
  results.forEach((result, index) => {
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(tags[index] ?? "");
    }
  });
});
