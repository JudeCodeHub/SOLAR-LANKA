import assert from "node:assert/strict";
import test from "node:test";

import { actionsFor, articleBody, currency, emptySource, paragraphs, slugify, validateArticle, type ArticleForm } from "./education.ts";

const good: ArticleForm = {
  category_id: "c1", slug: "net-metering", title: "Net metering", summary: "s", body: "b",
  sources: [{ title: "T", publisher: "P", url: "https://example.org", accessed_on: "2026-09-28" }],
  time_sensitive: false, valid_as_of: "", review_by: "", is_sample: true,
};

test("the body is split into text paragraphs and markup stays as plain text", () => {
  assert.deepEqual(paragraphs("One.\n\n  Two <b>bold</b> <script>x</script>.\n\n\n"), ["One.", "Two <b>bold</b> <script>x</script>."]);
});

test("time-sensitive and overdue content is told apart from current content", () => {
  assert.equal(currency({ time_sensitive: false, review_overdue: false }), "current");
  assert.equal(currency({ time_sensitive: true, review_overdue: false }), "time-sensitive");
  assert.equal(currency({ time_sensitive: true, review_overdue: true }), "overdue");
});

test("a title becomes a clean address", () => {
  assert.equal(slugify("Net metering: how it works!"), "net-metering-how-it-works");
  assert.equal(slugify("  Café  solar "), "cafe-solar");
});

test("a complete form has no problems and sends trimmed text with optional dates omitted", () => {
  assert.deepEqual(validateArticle(good), {});
  assert.equal(articleBody({ ...good, title: "  Net metering " }).title, "Net metering");
  assert.equal(articleBody(good).valid_as_of, null);
});

test("each problem is named on its field, including inside a source", () => {
  const errors = validateArticle({ ...good, category_id: "", slug: "Bad Slug", title: " ", sources: [emptySource()] });
  for (const key of ["category_id", "slug", "title", "sources.0.title", "sources.0.publisher", "sources.0.url", "sources.0.accessed_on"]) assert.ok(errors[key], key);
});

test("time-sensitive content needs both dates and a later review date", () => {
  assert.ok(validateArticle({ ...good, time_sensitive: true }).valid_as_of);
  assert.ok(validateArticle({ ...good, time_sensitive: true, valid_as_of: "2026-09-28", review_by: "2026-09-28" }).review_by);
  assert.deepEqual(validateArticle({ ...good, time_sensitive: true, valid_as_of: "2026-09-28", review_by: "2027-03-28" }), {});
});

test("controls follow the article's status and review", () => {
  assert.deepEqual(actionsFor("draft", false), { edit: true, review: true, publish: false, unpublish: false, archive: true });
  assert.deepEqual(actionsFor("draft", true), { edit: true, review: false, publish: true, unpublish: false, archive: true });
  assert.deepEqual(actionsFor("published", true), { edit: false, review: false, publish: false, unpublish: true, archive: true });
});
