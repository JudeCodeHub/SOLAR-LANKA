import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "./index.ts";

test("the brand wording is short, plain and free of markup", () => {
  const { tagline, heroLine, heroSupport, primaryAction, secondaryAction, microcopy } = messages.brand;
  assert.ok(tagline.length <= 40 && heroLine.length <= 60 && primaryAction.length <= 24 && secondaryAction.length <= 24);
  assert.ok(heroSupport.length <= 160);
  for (const text of [tagline, heroLine, heroSupport, primaryAction, secondaryAction, ...Object.values(microcopy)]) {
    assert.ok(!/[<>{}]/.test(text), text);
    assert.ok(text.trim() === text && text.length > 0, text);
  }
});
