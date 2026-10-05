import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "./index.ts";

test("the brand wording is short, plain and free of markup", () => {
  const { tagline, heroLine, heroSupport, primaryAction, secondaryAction, trustLine, microcopy } = messages.brand;
  assert.ok(tagline.length <= 40 && heroLine.length <= 60 && primaryAction.length <= 24 && secondaryAction.length <= 24);
  assert.ok(heroSupport.length <= 160 && trustLine.length <= 100);
  for (const text of [tagline, heroLine, heroSupport, primaryAction, secondaryAction, trustLine, ...Object.values(microcopy)]) {
    assert.ok(!/[<>{}]/.test(text), text);
    assert.ok(text.trim() === text && text.length > 0, text);
  }
});

test("the trust line says the data is fictional, as the footer does", () => {
  assert.match(messages.brand.trustLine, /fictional/i);
});
