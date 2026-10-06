import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "./index.ts";

const story = messages.landing.story;

function leaves(value: unknown): string[] {
  return typeof value === "string" ? [value] : Object.values(value as Record<string, unknown>).flatMap(leaves);
}

test("every landing sentence is plain text with no markup and no stray spaces", () => {
  for (const text of leaves(story)) {
    assert.ok(!/[<>{}]/.test(text.replace(/\{\w+\}/g, "")), text);
    assert.ok(text.trim() === text && text.length > 0, text);
  }
});

test("headlines are short, and each section has the four things the page needs", () => {
  for (const [name, section] of Object.entries(story)) {
    const title = (section as { title: string }).title;
    assert.ok(title.length > 0 && title.length <= 60, `${name} headline`);
  }
  assert.deepEqual(Object.keys(story.how.steps), ["estimate", "compare", "choose", "track"]);
  assert.deepEqual(Object.keys(story.features).filter((key) => key !== "eyebrow" && key !== "title"), ["estimate", "compare", "track", "learn"]);
});

test("fictional and sample content is labelled, and safety leads with safety, not a sales line", () => {
  assert.match(story.companies.sampleLabel, /fictional/i);
  assert.match(story.teaser.sampleLabel, /sample/i);
  assert.match(story.comparison.sampleLabel, /sample/i);
  assert.match(story.safety.title, /safety/i);
  assert.match(story.safety.body, /stop/i);
  assert.match(story.catalogue.body, /Not specified/);
});
