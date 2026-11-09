import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** `frameWidth` を持つストーリーの id */
const FRAMED_STORIES = [
  "parts-layoutcolumns--narrow",
  "parts-cardgrid--narrow",
  "parts-lightbox--narrow",
  "parts-wide--small-screen",
  "parts-highlight--long",
  "parts-gallery--narrow-two",
  "parts-gallery--narrow-one",
];

// `frameWidth` の枠は、390px の画面幅でも横にはみ出さない
test.each(FRAMED_STORIES)(
  "test_frame_width_fits_small_screen %s",
  async (id) => {
    // 準備・実行
    const page = await holder.openStory(id, { width: 390, height: 844 });
    // 検証
    await expect(pageOverflows(page)).resolves.toBe(false);
  },
);
