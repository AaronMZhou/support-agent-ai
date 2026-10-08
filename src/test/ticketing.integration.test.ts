// @vitest-environment node
// Integration test: a real HTTP mock ticketing API with injected failures,
// driven by the same processJob/idempotency code the edge functions use.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  idempotencyKey,
  pickFailure,
  processJob,
  seededRandom,
  TicketApiError,
  type QueueJob,
} from "../../supabase/functions/_shared/ticket-core";

const FAIL_RATE = 0.4;
const CALLS = 150;
const SUBMITS_PER_CALL = 3; // technicians double/triple-clicking Submit

const tickets = new Map<string, { externalId: string; callId: string }>();
const stats = { requests: 0, failBefore: 0, failAfter: 0 };
const rand = seededRandom(42);
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
      const failure = pickFailure(FAIL_RATE, rand);
      if (failure === "fail_before_write") {
        stats.failBefore++;
        return send(503, { error: "injected" });
      }
      const { callId } = JSON.parse(body);
      if (!tickets.has(key)) tickets.set(key, { externalId: `TKT-${tickets.size + 1}`, callId });
      if (failure === "fail_after_write") {
        stats.failAfter++;
        return send(502, { error: "injected after write" });
      }
      send(201, { externalId: tickets.get(key)!.externalId });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function createTicket(key: string, payload: unknown) {
  const res = await fetch(`${baseUrl}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new TicketApiError(data.error, res.status);
  return { externalId: data.externalId as string };
}

type Job = QueueJob & { status: "pending" | "succeeded" | "dead_letter"; next: number };

describe("ticket queue against mock ticketing API", () => {
  it("creates zero duplicate tickets under injected failures", async () => {
    // Idempotent enqueue (mirrors the unique idempotency_key column).
    const queue = new Map<string, Job>();
    for (let c = 0; c < CALLS; c++) {
      for (let s = 0; s < SUBMITS_PER_CALL; s++) {
        const key = idempotencyKey(`CALL-${c}`, "tech-1");
        if (!queue.has(key)) {
          queue.set(key, {
            idempotency_key: key, call_id: `CALL-${c}`, attempts: 0, max_attempts: 12, status: "pending", next: 0,
            final_draft: { shortTitle: `Issue ${c}`, problemSummary: "Something broke" },
          });
        }
      }
    }
    expect(queue.size).toBe(CALLS);

    // Simulated clock: each round jumps past every scheduled retry.
    let clock = 0;
    for (let round = 0; round < 50; round++) {
      const ready = [...queue.values()].filter((j) => j.status === "pending" && j.next <= clock);
      if (ready.length === 0 && ![...queue.values()].some((j) => j.status === "pending")) break;
      await Promise.all(ready.map(async (job) => {
        const out = await processJob(job, { createTicket, now: () => new Date(clock), rand, backoff: { baseMs: 10, capMs: 1000 } });
        job.attempts = out.attempts;
        if (out.kind === "succeeded") job.status = "succeeded";
        else if (out.kind === "dead_letter") job.status = "dead_letter";
        else job.next = out.nextAttemptAt.getTime();
      }));
      clock += 1000;
    }

    const injected = stats.failBefore + stats.failAfter;
    const ticketsPerCall = new Map<string, number>();
    for (const t of tickets.values()) ticketsPerCall.set(t.callId, (ticketsPerCall.get(t.callId) ?? 0) + 1);
    const duplicates = [...ticketsPerCall.values()].filter((n) => n > 1).length;

    console.log(`[failure-injection] submits=${CALLS * SUBMITS_PER_CALL} jobs=${CALLS} requests=${stats.requests} injected_failures=${injected} (lost_responses=${stats.failAfter}) tickets=${tickets.size} duplicates=${duplicates}`);

    expect(injected).toBeGreaterThan(50);
    expect(stats.failAfter).toBeGreaterThan(0);
    expect(duplicates).toBe(0);
    expect(tickets.size).toBe(CALLS);
    expect([...queue.values()].every((j) => j.status === "succeeded")).toBe(true);
  });

  it("rejects requests without an idempotency key", async () => {
    const res = await fetch(`${baseUrl}/tickets`, { method: "POST", body: "{}" });
    await res.text();
    expect(res.status).toBe(400);
  });
});
