import assert from "node:assert/strict";
import test from "node:test";

import { EVIDENCE_MAX_BYTES, evidenceProblem } from "./evidence.ts";

test("a photo within the limit is accepted", () => {
  assert.equal(evidenceProblem({ name: "roof.jpg", type: "image/jpeg", size: 1000 }), null);
  assert.equal(evidenceProblem({ name: "roof.webp", type: "image/webp", size: EVIDENCE_MAX_BYTES }), null);
});

test("documents, empty files and oversized files are refused with the reason", () => {
  assert.match(evidenceProblem({ name: "plan.pdf", type: "application/pdf", size: 1000 }) ?? "", /plan\.pdf.*photo/i);
  assert.match(evidenceProblem({ name: "a.png", type: "image/png", size: 0 }) ?? "", /empty/i);
  assert.match(evidenceProblem({ name: "big.png", type: "image/png", size: EVIDENCE_MAX_BYTES + 1 }) ?? "", /8 MB/);
});
