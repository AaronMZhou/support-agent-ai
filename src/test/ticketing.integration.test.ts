// @vitest-environment node
// Integration test: a real HTTP mock ticketing API with injected failures,
// driven by the same client, batch runner and idempotency code the edge
// functions use. The in-memory store mirrors ticket_jobs + claim_ticket_jobs.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createTicketOverHttp,
  idempotencyKey,
  outcomePatch,
  pickFailure,
  runBatch,
  seededRandom,
  type ClaimedJob,
  type JobStore,
  type ProcessDeps,
} from "../../supabase/functions/_shared/ticket-core";

const CALLS = 150;
const SUBMITS_PER_CALL = 3; // technicians double/triple-clicking Submit
const API_FAIL_RATE = 0.4;
const SAVE_FAIL_RATE = 0.15; // worker dies after the API call, before recording the result
const LEASE_SECONDS = 60;
const TIMEOUT_MS = 150;

const newStats = () => ({ requests: 0, status503: 0, dropBefore: 0, status502: 0, dropAfter: 0, hang: 0, truncated: 0 });

const tickets = new Map<string, { externalId: string; callId: string }>();
let stats = newStats();
let failRate = 0;
let rand = seededRandom(42);
let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      stats.requests++;
      const key = req.headers["idempotency-key"] as string | undefined;
      const send = (status: number, data: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      };
      if (!key) return send(400, { error: "Idempotency-Key required" });
      if (req.url === "/down") return send(503, { error: "ticketing system down" });
      if (req.url === "/reject") return send(422, { error: "ticket rejected" });

      const failure = pickFailure(failRate, rand);
      if (failure === "fail_before_write") {
        if (rand() < 0.5) {
          stats.status503++;
          return send(503, { error: "injected" });
        }
        stats.dropBefore++;
        return void req.socket.destroy(); // network failure, nothing saved
      }

      const { callId } = JSON.parse(body);
      if (!tickets.has(key)) tickets.set(key, { externalId: `TKT-${tickets.size + 1}`, callId });
      if (failure === "fail_after_write") {
        // The ticket exists but the worker never gets a usable acknowledgment.
        const r = rand();
        if (r < 0.25) {
          stats.status502++;
          return send(502, { error: "injected after write" });
        }
        if (r < 0.5) {
          stats.dropAfter++;
          return void req.socket.destroy();
        }
        if (r < 0.75) {
          stats.hang++;
          return; // never answers; the client times out
        }
        stats.truncated++;
        res.writeHead(201, { "Content-Type": "application/json", "Content-Length": 64 });
        res.write('{"externalId":"TK');
        return void setTimeout(() => res.destroy(), 5);
      }
      send(201, { externalId: tickets.get(key)!.externalId });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  tickets.clear();
  stats = newStats();
  failRate = 0;
  rand = seededRandom(42);
});

afterAll(() => {
  server.closeAllConnections();
  return new Promise<void>((r) => server.close(() => r()));
});

const apiDeps = (path: string, extra: Partial<ProcessDeps> = {}): ProcessDeps => ({
  createTicket: (key, payload) => createTicketOverHttp(`${baseUrl}${path}`, key, payload, { timeoutMs: TIMEOUT_MS }),
  backoff: { baseMs: 10, capMs: 1000 },
  ...extra,
});

interface Row extends ClaimedJob {
  status: "pending" | "processing" | "succeeded" | "dead_letter";
  next_attempt_at: string;
  locked_until: string | null;
  last_error: string | null;
  external_ticket_id: string | null;
}

/** In-memory ticket_jobs table with the same enqueue, claim and save rules as the database. */
function memoryQueue(clock: { now: number }, saveFails: () => boolean = () => false) {
  const rows = new Map<string, Row>();
  const at = (iso: string | null) => (iso ? Date.parse(iso) : 0);
  const store: JobStore = {
    async claim(limit, leaseSeconds) {
      const ready = [...rows.values()]
        .filter((r) =>
          (r.status === "pending" && at(r.next_attempt_at) <= clock.now) ||
          (r.status === "processing" && at(r.locked_until) < clock.now))
        .sort((a, b) => at(a.next_attempt_at) - at(b.next_attempt_at))
        .slice(0, limit);
      for (const r of ready) {
        r.status = "processing";
        r.locked_until = new Date(clock.now + leaseSeconds * 1000).toISOString();
      }
      return ready.map((r) => ({ ...r }));
    },
    async save(job, outcome) {
      if (saveFails()) throw new Error("injected: job result not recorded");
      const row = rows.get(job.idempotency_key)!;
      if (row.status === "processing") Object.assign(row, outcomePatch(outcome, new Date(clock.now)));
    },
  };
  return {
    rows,
    store,
    /** Unique idempotency_key: a repeated submit keeps the existing job. */
    enqueue(callId: string, technicianId: string, maxAttempts = 12) {
      const key = idempotencyKey(callId, technicianId);
      if (rows.has(key)) return;
      rows.set(key, {
        id: `job-${rows.size + 1}`, idempotency_key: key, call_id: callId, attempts: 0, max_attempts: maxAttempts,
        final_draft: { shortTitle: `Issue ${callId}`, problemSummary: "Something broke" },
        status: "pending", next_attempt_at: new Date(clock.now).toISOString(), locked_until: null,
        last_error: null, external_ticket_id: null,
      });
    },
    /** Same reset the dashboard's dead-letter retry applies. */
    requeue(key: string) {
      const row = rows.get(key)!;
      if (row.status !== "dead_letter") return;
      Object.assign(row, { status: "pending", attempts: 0, next_attempt_at: new Date(clock.now).toISOString(), last_error: null });
    },
  };
}

describe("ticket queue against mock ticketing API", () => {
  it("creates exactly one ticket per call under network and acknowledgment failures", async () => {
    failRate = API_FAIL_RATE;
    const clock = { now: 0 };
    let unsaved = 0;
    const queue = memoryQueue(clock, () => rand() < SAVE_FAIL_RATE);
    for (let c = 0; c < CALLS; c++) {
      for (let s = 0; s < SUBMITS_PER_CALL; s++) queue.enqueue(`CALL-${c}`, "tech-1");
    }
    expect(queue.rows.size).toBe(CALLS);

    // Each round runs three concurrent workers, then jumps the clock past
    // every scheduled retry and every lease left behind by a lost save.
    const deps = apiDeps("/tickets", { now: () => new Date(clock.now), rand });
    for (let round = 0; round < 60; round++) {
      if ([...queue.rows.values()].every((r) => r.status === "succeeded" || r.status === "dead_letter")) break;
      const results = await Promise.all([1, 2, 3].map(() => runBatch(queue.store, deps, { limit: 25, leaseSeconds: LEASE_SECONDS })));
      unsaved += results.reduce((n, r) => n + r.unsaved, 0);
      clock.now += (LEASE_SECONDS + 1) * 1000;
    }

    const lostAcks = stats.status502 + stats.dropAfter + stats.hang + stats.truncated;
    const injected = stats.status503 + stats.dropBefore + lostAcks;
    const ticketsPerCall = new Map<string, number>();
    for (const t of tickets.values()) ticketsPerCall.set(t.callId, (ticketsPerCall.get(t.callId) ?? 0) + 1);
    const duplicates = [...ticketsPerCall.values()].filter((n) => n > 1).length;

    console.log(`[failure-injection] submits=${CALLS * SUBMITS_PER_CALL} jobs=${CALLS} requests=${stats.requests} injected_api_failures=${injected} (http_503=${stats.status503} dropped_before_write=${stats.dropBefore} lost_acks=${lostAcks}: http_502=${stats.status502} dropped=${stats.dropAfter} timed_out=${stats.hang} truncated=${stats.truncated}) lost_job_saves=${unsaved} tickets=${tickets.size} duplicates=${duplicates}`);

    // Every kind of fault actually happened.
    for (const n of [stats.status503, stats.dropBefore, stats.status502, stats.dropAfter, stats.hang, stats.truncated, unsaved]) {
      expect(n).toBeGreaterThan(0);
    }
    expect(injected).toBeGreaterThan(50);

    expect(duplicates).toBe(0);
    expect(tickets.size).toBe(CALLS);
    for (const row of queue.rows.values()) {
      expect(row.status).toBe("succeeded");
      expect(row.external_ticket_id).toBe(tickets.get(row.idempotency_key)!.externalId);
    }
  }, 30_000);

  it("gives the same ticket to two workers delivering the same job at once", async () => {
    const key = idempotencyKey("CALL-X", "tech-1");
    const payload = { callId: "CALL-X", draft: {} };
    const [a, b] = await Promise.all([
      createTicketOverHttp(`${baseUrl}/tickets`, key, payload),
      createTicketOverHttp(`${baseUrl}/tickets`, key, payload),
    ]);
    expect(a.externalId).toBe(b.externalId);
    expect(tickets.size).toBe(1);
  });

  it("backs off exponentially, dead-letters after max attempts, and a requeue creates one ticket", async () => {
    const clock = { now: 0 };
    const queue = memoryQueue(clock);
    queue.enqueue("CALL-DOWN", "tech-1", 4);
    const row = [...queue.rows.values()][0];

    // rand pinned just under 1 so each delay sits at its exponential ceiling.
    const down = apiDeps("/down", { now: () => new Date(clock.now), rand: () => 0.999999 });
    const delays: number[] = [];
    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await runBatch(queue.store, down);
      expect(result.claimed).toBe(1);
      expect(row.attempts).toBe(attempt);
      if (row.status !== "pending") break;
      delays.push(Date.parse(row.next_attempt_at) - clock.now);
      expect((await runBatch(queue.store, down)).claimed).toBe(0); // not due yet
      clock.now = Date.parse(row.next_attempt_at);
    }
    expect(delays).toEqual([9, 19, 39]);
    expect(row).toMatchObject({ status: "dead_letter", attempts: 4, last_error: "ticketing system down" });
    expect(tickets.size).toBe(0);

    // Dead-lettered jobs are parked until someone requeues them.
    clock.now += 3_600_000;
    expect((await runBatch(queue.store, down)).claimed).toBe(0);

    queue.requeue(row.idempotency_key);
    const result = await runBatch(queue.store, apiDeps("/tickets"));
    expect(result.succeeded).toBe(1);
    expect(row).toMatchObject({ status: "succeeded", attempts: 1, last_error: null });
    expect(row.external_ticket_id).toBe(tickets.get(row.idempotency_key)!.externalId);
    expect(tickets.size).toBe(1);
  });

  it("dead-letters a rejected ticket on the first attempt", async () => {
    const clock = { now: 0 };
    const queue = memoryQueue(clock);
    queue.enqueue("CALL-BAD", "tech-1");
    const result = await runBatch(queue.store, apiDeps("/reject"));
    expect(result.deadLettered).toBe(1);
    expect([...queue.rows.values()][0]).toMatchObject({ status: "dead_letter", attempts: 1, last_error: "ticket rejected" });
    expect(stats.requests).toBe(1);
  });

  it("rejects requests without an idempotency key", async () => {
    const res = await fetch(`${baseUrl}/tickets`, { method: "POST", body: "{}" });
    await res.text();
    expect(res.status).toBe(400);
  });
});
