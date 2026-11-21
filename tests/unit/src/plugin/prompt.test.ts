import { expect, test } from "vitest";
import { stringify } from "yaml";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** プロンプトファイルの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPromptModule = () => import("../../../../src/plugin/prompt.ts");

const createTempDir = useTempDirs();

/** テストで使用するプロンプトファイルの値 */
type TestPrompt = {
  id: string;
  name: string;
  description: string;
  kind: "instructions" | "tool";
  lang: string;
  vars: Record<string, Record<string, unknown>>;
  parts: { id: string; when?: string; texts: { lang: string; text: string }[] }[];
};

/** テストで使用するプロンプトファイルの値を作る */
const createPrompt = (overrides: Partial<TestPrompt> = {}): TestPrompt => ({
  id: "mcp/x/instructions",
  name: "x の instructions",
  description: "x の使用方法を伝える",
  kind: "instructions",
  lang: "ja",
  vars: {},
  parts: [{ id: "body", texts: [{ lang: "ja", text: "本文\n" }] }],
  ...overrides,
});

/** `content/prompts/{id}.yaml` にプロンプトファイルを書き込み、パッケージの直下を返却する */
const writePrompt = async (prompt: TestPrompt) => {
  const root = await createTempDir();
  await writeFiles(root, {
    [`content/prompts/${prompt.id}.yaml`]: stringify(prompt),
  });
  return root;
};

// 合うプロンプトファイルを返却する（正常系）
test("test_load_prompt", async () => {
  // 準備
  const { loadPrompt } = await loadPromptModule();
  const prompt = createPrompt();
  const root = await writePrompt(prompt);
  // 実行
  const loaded = await loadPrompt({ root, id: "mcp/x/instructions" });
  // 検証
  expect(loaded.id).toBe("mcp/x/instructions");
  expect(loaded.parts).toEqual(prompt.parts);
});

// lang の本文が無い部品を誤りにする（異常系）
test("test_load_prompt_when_lang_missing", async () => {
  // 準備
  const { loadPrompt, PromptError } = await loadPromptModule();
  const root = await writePrompt(
    createPrompt({
      parts: [
        { id: "body", texts: [{ lang: "ja", text: "本文\n" }] },
        { id: "english-only", texts: [{ lang: "en", text: "Body\n" }] },
      ],
    }),
  );
  // 実行・検証
  const loading = loadPrompt({ root, id: "mcp/x/instructions" });
  await expect(loading).rejects.toThrow(PromptError);
  await expect(loading).rejects.toThrow("english-only");
});

// ファイルが無いと誤りにする（異常系）
test("test_load_prompt_when_file_missing", async () => {
  // 準備
  const { loadPrompt, PromptError } = await loadPromptModule();
  const root = await createTempDir();
  // 実行・検証
  const loading = loadPrompt({ root, id: "mcp/x/missing" });
  await expect(loading).rejects.toThrow(PromptError);
  await expect(loading).rejects.toThrow("content/prompts/mcp/x/missing.yaml");
});

// 変数を入れて本文を描く（正常系）
test("test_render_prompt", async () => {
  // 準備
  const { renderPrompt } = await loadPromptModule();
  const prompt = createPrompt({
    vars: {
      location: {
        type: "string",
        required: true,
        description: "常駐サーバーが動いている場所",
        example: "unit x",
      },
    },
    parts: [{ id: "body", texts: [{ lang: "ja", text: "{{ location }}で動く\n" }] }],
  });
  // 実行
  const text = renderPrompt(prompt, { location: "unit x" });
  // 検証
  expect(text).toBe("unit xで動く");
});

// when が偽の部品を除く（正常系）
test("test_render_prompt_when_part_hidden", async () => {
  // 準備
  const { renderPrompt } = await loadPromptModule();
  const prompt = createPrompt({
    vars: {
      items: {
        type: "array",
        description: "並べる項目",
        example: ["a"],
        items: { type: "string", description: "項目" },
      },
    },
    parts: [
      { id: "head", texts: [{ lang: "ja", text: "見出し\n" }] },
      {
        id: "items",
        when: "{{ items | length > 0 }}",
        texts: [{ lang: "ja", text: "項目がある\n" }],
      },
    ],
  });
  // 実行
  const text = renderPrompt(prompt, { items: [] });
  // 検証
  expect(text).toBe("見出し");
});

// 部品を区切り無しでつなぎ、末尾の改行を除く（正常系）
test("test_render_prompt_joins_parts", async () => {
  // 準備
  const { renderPrompt } = await loadPromptModule();
  const prompt = createPrompt({
    parts: [
      { id: "first", texts: [{ lang: "ja", text: "a\n" }] },
      { id: "second", texts: [{ lang: "ja", text: "b\n" }] },
    ],
  });
  // 実行
  const text = renderPrompt(prompt, {});
  // 検証
  expect(text).toBe("a\nb");
});

// 未定義の変数を誤りにする（異常系）
test("test_render_prompt_when_variable_undefined", async () => {
  // 準備
  const { renderPrompt, PromptError } = await loadPromptModule();
  const prompt = createPrompt({
    parts: [{ id: "body", texts: [{ lang: "ja", text: "{{ nope }}\n" }] }],
  });
  // 実行・検証
  expect(() => renderPrompt(prompt, {})).toThrow(PromptError);
  expect(() => renderPrompt(prompt, {})).toThrow("nope");
});

// 必須の変数が無いと誤りにする（異常系）
test("test_render_prompt_when_required_missing", async () => {
  // 準備
  const { renderPrompt, PromptError } = await loadPromptModule();
  const prompt = createPrompt({
    vars: {
      location: {
        type: "string",
        required: true,
        description: "常駐サーバーが動いている場所",
        example: "unit x",
      },
    },
    parts: [{ id: "body", texts: [{ lang: "ja", text: "{{ location }}\n" }] }],
  });
  // 実行・検証
  expect(() => renderPrompt(prompt, {})).toThrow(PromptError);
  expect(() => renderPrompt(prompt, {})).toThrow("location");
});

// 使用しない構文を誤りにする（異常系）
test("test_render_prompt_when_syntax_unsupported", async () => {
  // 準備
  const { renderPrompt, PromptError } = await loadPromptModule();
  const prompt = createPrompt({
    parts: [
      { id: "body", texts: [{ lang: "ja", text: "{% set x = 1 %}{{ x }}\n" }] },
    ],
  });
  // 実行・検証
  expect(() => renderPrompt(prompt, {})).toThrow(PromptError);
});
