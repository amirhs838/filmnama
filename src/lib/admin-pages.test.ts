import test from "node:test";
import assert from "node:assert/strict";
import {
  leadNextActionLabel,
  leadStatusLabel,
  nextLeadStatus,
  normalizeFaqRows,
} from "./admin-ui";

test("faq rows trim and drop blank questions while keeping answers trimmed", () => {
  assert.deepEqual(
    normalizeFaqRows([
      { question: " ", answer: "ignored" },
      { question: " پرسش ", answer: " پاسخ " },
      { question: "دوم", answer: "" },
    ]),
    [
      { question: "پرسش", answer: "پاسخ" },
      { question: "دوم", answer: "" },
    ],
  );
  assert.deepEqual(normalizeFaqRows([]), []);
  assert.deepEqual(normalizeFaqRows([{ question: "  ", answer: "  " }]), []);
});

test("lead status advances NEW to CONTACTED to CLOSED then stays terminal", () => {
  assert.equal(nextLeadStatus("NEW"), "CONTACTED");
  assert.equal(nextLeadStatus("CONTACTED"), "CLOSED");
  assert.equal(nextLeadStatus("CLOSED"), null);
});

test("lead status labels cover all three workflow states", () => {
  assert.equal(leadStatusLabel("NEW"), "جدید");
  assert.equal(leadStatusLabel("CONTACTED"), "در تماس");
  assert.equal(leadStatusLabel("CLOSED"), "بسته");
});

test("lead next action labels exist only for non-terminal states", () => {
  assert.equal(leadNextActionLabel("NEW"), "علامت به‌عنوان در تماس");
  assert.equal(leadNextActionLabel("CONTACTED"), "بستن");
  assert.equal(leadNextActionLabel("CLOSED"), null);
});

test("faq normalization preserves order and never mutates input rows", () => {
  const input = [
    { question: " اول ", answer: " یک " },
    { question: "", answer: "حذف" },
    { question: " دوم ", answer: " دو " },
  ];
  const snapshot = input.map((row) => ({ ...row }));
  const result = normalizeFaqRows(input);
  assert.deepEqual(
    result.map((row) => row.question),
    ["اول", "دوم"],
  );
  assert.deepEqual(input, snapshot);
});
