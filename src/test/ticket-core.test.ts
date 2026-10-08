import { describe, it, expect } from "vitest";
import {
  parseTicketDraft,
  DraftParseError,
  idempotencyKey,
  isDraftEdited,
  backoffMs,
  isRetryable,
  TicketApiError,
  processJob,
  pickFailure,
  seededRandom,
} from "../../supabase/functions/_shared/ticket-core";

const draft = {
  shortTitle: "Outlook crash",
  category: "Email",
  problemSummary: "Crashes on startup",
  observedSymptoms: ["closes", "error flash"],
  stepsAttempted: ["reboot"],
  recommendedNextAction: "Safe mode",
  resolutionStatus: "unresolved",
  notes: "",
};

describe("parseTicketDraft", () => {
  it("accepts an object", () => {
    expect(parseTicketDraft(draft).shortTitle).toBe("Outlook crash");
  });
  it("accepts fenced JSON from the LLM", () => {
    const out = parseTicketDraft("```json\n" + JSON.stringify(draft) + "\n```");
    expect(out.category).toBe("Email");
  });
  it("normalizes whitespace, lists and status", () => {
    const out = parseTicketDraft({ ...draft, shortTitle: "  a   b ", observedSymptoms: "x, y\nz", resolutionStatus: "Workaround Provided" });
    expect(out.shortTitle).toBe("a b");
    expect(out.observedSymptoms).toEqual(["x", "y", "z"]);
    expect(out.resolutionStatus).toBe("workaround_provided");
  });
  it("falls back for unknown status and missing category", () => {
    const out = parseTicketDraft({ ...draft, category: undefined, resolutionStatus: "banana" });
    expect(out.category).toBe("General");
    expect(out.resolutionStatus).toBe("unresolved");
  });
  it("rejects bad input", () => {
    expect(() => parseTicketDraft("not json")).toThrow(DraftParseError);
    expect(() => parseTicketDraft([])).toThrow(DraftParseError);
    expect(() => parseTicketDraft({ ...draft, shortTitle: "" })).toThrow(/shortTitle/);
  });
});

describe("dedup", () => {
  it("same call + technician gives the same key regardless of case/space", () => {
    expect(idempotencyKey(" CALL-1 ", "Tech")).toBe(idempotencyKey("call-1", "tech"));
    expect(idempotencyKey("CALL-1", "a")).not.toBe(idempotencyKey("CALL-2", "a"));
  });
  it("requires both parts", () => {
    expect(() => idempotencyKey("", "a")).toThrow();
  });
  it("detects technician edits, ignoring formatting noise", () => {
    expect(isDraftEdited(parseTicketDraft(draft), parseTicketDraft({ ...draft, notes: "  " }))).toBe(false);
    expect(isDraftEdited(parseTicketDraft(draft), parseTicketDraft({ ...draft, notes: "changed" }))).toBe(true);
  });
});

describe("backoff and retry policy", () => {
  it("grows exponentially and is capped", () => {
    const max = () => 0.999999;
    expect(backoffMs(1, max, { baseMs: 1000 })).toBeLessThan(1000);
    expect(backoffMs(4, max, { baseMs: 1000 })).toBeGreaterThan(7000);
    expect(backoffMs(30, max, { baseMs: 1000, capMs: 5000 })).toBeLessThan(5000);
  });
  it("retries transient errors only", () => {
    expect(isRetryable(new TicketApiError("x", 503))).toBe(true);
    expect(isRetryable(new TicketApiError("x", 429))).toBe(true);
    expect(isRetryable(new TicketApiError("x", null))).toBe(true);
    expect(isRetryable(new TicketApiError("x", 400))).toBe(false);
  });
  it("dead-letters after max attempts", async () => {
    const out = await processJob(
      { idempotency_key: "k", call_id: "c", final_draft: draft, attempts: 2, max_attempts: 3 },
      { createTicket: async () => { throw new TicketApiError("down", 503); } },
    );
    expect(out.kind).toBe("dead_letter");
  });
  it("dead-letters non-retryable errors immediately", async () => {
    const out = await processJob(
      { idempotency_key: "k", call_id: "c", final_draft: draft, attempts: 0, max_attempts: 5 },
      { createTicket: async () => { throw new TicketApiError("bad", 422); } },
    );
    expect(out).toMatchObject({ kind: "dead_letter", attempts: 1 });
  });
  it("schedules a retry in the future", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const out = await processJob(
      { idempotency_key: "k", call_id: "c", final_draft: draft, attempts: 0, max_attempts: 5 },
      { createTicket: async () => { throw new TicketApiError("down", 500); }, now: () => now, rand: () => 0.5 },
    );
    expect(out.kind).toBe("retry");
    if (out.kind === "retry") expect(out.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("failure injection", () => {
  it("is deterministic per seed and roughly matches the rate", () => {
    const a = seededRandom(1), b = seededRandom(1);
    expect(a()).toBe(b());
    const r = seededRandom(7);
    let fails = 0;
    for (let i = 0; i < 10000; i++) if (pickFailure(0.3, r) !== "none") fails++;
    expect(fails / 10000).toBeGreaterThan(0.27);
    expect(fails / 10000).toBeLessThan(0.33);
  });
});
