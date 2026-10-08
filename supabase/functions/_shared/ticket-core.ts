// Pure ticket-pipeline logic. No imports, so it runs unchanged in Deno (edge
// functions) and Node (Vitest unit + integration tests).

export type ResolutionStatus = "unresolved" | "resolved" | "workaround_provided" | "escalate";

export interface TicketDraft {
  shortTitle: string;
  category: string;
  problemSummary: string;
  observedSymptoms: string[];
  stepsAttempted: string[];
  recommendedNextAction: string;
  resolutionStatus: ResolutionStatus;
  notes: string;
}

const RESOLUTION_STATUSES: ResolutionStatus[] = ["unresolved", "resolved", "workaround_provided", "escalate"];

export class DraftParseError extends Error {}

function str(v: unknown, max = 4000): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

function strList(v: unknown): string[] {
  if (typeof v === "string") v = v.split(/[\n,;]+/);
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, 500)).filter(Boolean).slice(0, 50);
}

/**
 * Parse whatever the LLM returned into a strict ticket draft. Accepts an
 * object, a JSON string, or a JSON string wrapped in ``` fences.
 */
export function parseTicketDraft(raw: unknown): TicketDraft {
  let value: unknown = raw;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      value = JSON.parse(cleaned);
    } catch {
      throw new DraftParseError("Ticket draft is not valid JSON");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DraftParseError("Ticket draft must be an object");
  }
  const o = value as Record<string, unknown>;
  const shortTitle = str(o.shortTitle, 200);
  const problemSummary = str(o.problemSummary);
  if (!shortTitle) throw new DraftParseError("Ticket draft is missing shortTitle");
  if (!problemSummary) throw new DraftParseError("Ticket draft is missing problemSummary");

  const rs = str(o.resolutionStatus).toLowerCase().replace(/[\s-]+/g, "_") as ResolutionStatus;
  return {
    shortTitle,
    category: str(o.category, 200) || "General",
    problemSummary,
    observedSymptoms: strList(o.observedSymptoms),
    stepsAttempted: strList(o.stepsAttempted),
    recommendedNextAction: str(o.recommendedNextAction),
    resolutionStatus: RESOLUTION_STATUSES.includes(rs) ? rs : "unresolved",
    notes: str(o.notes),
  };
}

/** One ticket per technician per call, no matter how often it is submitted. */
export function idempotencyKey(callId: string, technicianId: string): string {
  const c = callId.trim().toLowerCase();
  const t = technicianId.trim().toLowerCase();
  if (!c || !t) throw new Error("callId and technicianId are required");
  return `ticket:${t}:${c}`;
}

/** True when the technician changed anything the AI filled in. */
export function isDraftEdited(ai: TicketDraft, final: TicketDraft): boolean {
  return JSON.stringify(parseTicketDraft(ai)) !== JSON.stringify(parseTicketDraft(final));
}

export interface BackoffOptions {
  baseMs?: number;
  capMs?: number;
}

/** Exponential backoff with full jitter. attempt starts at 1. */
export function backoffMs(attempt: number, rand: () => number = Math.random, opts: BackoffOptions = {}): number {
  const base = opts.baseMs ?? 2000;
  const cap = opts.capMs ?? 5 * 60 * 1000;
  const ceiling = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  return Math.floor(rand() * ceiling);
}

export class TicketApiError extends Error {
  constructor(message: string, public status: number | null) {
    super(message);
  }
}

/** Network errors, timeouts, 408, 429 and 5xx are worth retrying. Other 4xx are not. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof TicketApiError) {
    if (err.status === null) return true;
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  return true;
}

export interface QueueJob {
  idempotency_key: string;
  call_id: string;
  final_draft: unknown;
  attempts: number;
  max_attempts: number;
}

export type JobOutcome =
  | { kind: "succeeded"; externalId: string; attempts: number }
  | { kind: "retry"; attempts: number; nextAttemptAt: Date; error: string }
  | { kind: "dead_letter"; attempts: number; error: string };

export interface ProcessDeps {
  createTicket: (key: string, payload: { callId: string; draft: TicketDraft }) => Promise<{ externalId: string }>;
  now?: () => Date;
  rand?: () => number;
  backoff?: BackoffOptions;
}

/** Run one delivery attempt and decide what happens to the job next. */
export async function processJob(job: QueueJob, deps: ProcessDeps): Promise<JobOutcome> {
  const attempts = job.attempts + 1;
  let draft: TicketDraft;
  try {
    draft = parseTicketDraft(job.final_draft);
  } catch (e) {
    return { kind: "dead_letter", attempts, error: `Invalid draft: ${(e as Error).message}` };
  }
  try {
    const { externalId } = await deps.createTicket(job.idempotency_key, { callId: job.call_id, draft });
    return { kind: "succeeded", externalId, attempts };
  } catch (e) {
    const error = (e as Error).message || "Ticket API error";
    if (!isRetryable(e) || attempts >= job.max_attempts) {
      return { kind: "dead_letter", attempts, error };
    }
    const now = (deps.now ?? (() => new Date()))();
    const delay = backoffMs(attempts, deps.rand, deps.backoff);
    return { kind: "retry", attempts, nextAttemptAt: new Date(now.getTime() + delay), error };
  }
}

/** Deterministic PRNG for repeatable failure injection. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type InjectedFailure = "none" | "fail_before_write" | "fail_after_write";

/** Pick a failure mode. fail_after_write simulates "ticket saved but response lost". */
export function pickFailure(failRate: number, rand: () => number): InjectedFailure {
  if (failRate <= 0) return "none";
  const r = rand();
  if (r >= failRate) return "none";
  return r < failRate / 2 ? "fail_before_write" : "fail_after_write";
}
