import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  avatarSpriteUrl,
  avatarStyles,
  suggestAvatar,
} from "../src/lib/office/avatar";

test("fictional bot names suggest a look, with a neutral fallback for ambiguous names", () => {
  assert.equal(suggestAvatar("Copywriting Cathy"), "feminine");
  assert.equal(suggestAvatar("MANAGER MARG"), "feminine");
  assert.equal(suggestAvatar("José — Sales"), "masculine");
  assert.equal(suggestAvatar("Sales Sam"), "neutral");
  assert.equal(suggestAvatar("Cathy and John"), "neutral");
  assert.equal(suggestAvatar("Reporting Operations"), "neutral");
  assert.equal(suggestAvatar("Annalytics"), "neutral");
});

test("each avatar has a four-frame strip for the canvas and sidebar portrait", async () => {
  const strips = await Promise.all(
    avatarStyles.map(async (style) => {
      const image = await readFile(`public${avatarSpriteUrl(style)}`);
      assert.equal(image.readUInt32BE(16), 128);
      assert.equal(image.readUInt32BE(20), 40);
      return image.toString("base64");
    }),
  );
  assert.equal(new Set(strips).size, avatarStyles.length);
});
