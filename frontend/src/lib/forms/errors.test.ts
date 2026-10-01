import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { collectFieldProblems, fieldId, issueFieldPath } from "./errors.ts";
import { installZodMessages } from "./zod-messages.ts";

installZodMessages();

const firstMessage = (schema: z.ZodType, value: unknown) => {
  const result = schema.safeParse(value);
  assert.equal(result.success, false);
  return result.error!.issues[0]!.message;
};

test("Zod checks use the message catalog", () => {
  assert.equal(firstMessage(z.string().min(1), ""), "This field is required.");
  assert.equal(firstMessage(z.object({ a: z.string() }).shape.a, undefined), "This field is required.");
  assert.equal(firstMessage(z.email(), "nope"), "Enter a valid email address.");
  assert.equal(firstMessage(z.string().min(8), "short"), "Enter at least 8 characters.");
  assert.equal(firstMessage(z.string().min(2), "a"), "Enter at least 2 characters.");
  assert.equal(firstMessage(z.string().max(1), "abc"), "Enter no more than 1 character.");
  assert.equal(firstMessage(z.number().min(10), 3), "Enter a value of 10 or more.");
  assert.equal(firstMessage(z.number().max(5), 9), "Enter a value of 5 or less.");
  assert.equal(firstMessage(z.number(), "abc"), "Enter a number.");
  assert.equal(firstMessage(z.array(z.string()).min(1), []), "This field is required.");
});

test("a message written in the schema is not replaced", () => {
  assert.equal(firstMessage(z.string().min(1, "Enter your district."), ""), "Enter your district.");
});

test("collectFieldProblems flattens nested errors in order and skips DOM refs", () => {
  const ref = { focus() {} };
  const problems = collectFieldProblems({
    email: { type: "too_small", message: "Email problem", ref },
    items: [
      undefined,
      { quantity: { type: "too_small", message: "Quantity problem", ref } },
    ],
    root: { server: { type: "server", message: "General problem" } },
  } as never);
  assert.deepEqual(problems, [
    { name: "email", message: "Email problem" },
    { name: "items.1.quantity", message: "Quantity problem" },
    { name: "root.server", message: "General problem" },
  ]);
  assert.deepEqual(collectFieldProblems({}), []);
});

test("fieldId is unique per form and safe for nested names", () => {
  assert.equal(fieldId("form1", "email"), "form1-email");
  assert.equal(fieldId("form1", "items.0.quantity"), "form1-items-0-quantity");
  assert.notEqual(fieldId("form1", "email"), fieldId("form2", "email"));
});

test("backend issue locations map to form fields or to nothing", () => {
  const known = new Set(["district", "items"]);
  assert.equal(issueFieldPath(["body", "district"], known), "district");
  assert.equal(issueFieldPath(["body", "items", 0, "quantity"], known), "items.0.quantity");
  assert.equal(issueFieldPath(["district"], known), "district");
  assert.equal(issueFieldPath(["body", "unknown_field"], known), null);
  assert.equal(issueFieldPath(["query", "limit"], known), null);
  assert.equal(issueFieldPath([], known), null);
  assert.equal(issueFieldPath(undefined, known), null);
});
