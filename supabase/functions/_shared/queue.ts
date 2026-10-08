import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { processJob, TicketApiError, type QueueJob } from "./ticket-core.ts";

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Validate the caller's bearer token and return their user id, or null. */
export async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

const MAX_BATCH = 10;

async function createTicketViaApi(key: string, payload: unknown, failRate: number) {
  let res: Response;
  try {
    res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/mock-ticketing-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Idempotency-Key": key,
        "X-Fail-Rate": String(failRate),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new TicketApiError(`Network error: ${(e as Error).message}`, null);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new TicketApiError(body.error ?? `Ticket API status ${res.status}`, res.status);
  return { externalId: String(body.externalId) };
}

/** Claim and process one bounded batch. Each job's result is saved as soon as it finishes. */
export async function processBatch(db: SupabaseClient, failRate = 0) {
  const { data: jobs, error } = await db.rpc("claim_ticket_jobs", { p_limit: MAX_BATCH, p_lease_seconds: 60 });
  if (error) throw new Error(`Claim failed: ${error.message}`);
  const results = { claimed: jobs?.length ?? 0, succeeded: 0, retried: 0, deadLettered: 0 };

  for (const job of (jobs ?? []) as (QueueJob & { id: string })[]) {
    const outcome = await processJob(job, {
      createTicket: (key, payload) => createTicketViaApi(key, payload, failRate),
    });
    const base = { attempts: outcome.attempts, locked_until: null, updated_at: new Date().toISOString() };
    let update: Record<string, unknown>;
    if (outcome.kind === "succeeded") {
      update = { ...base, status: "succeeded", external_ticket_id: outcome.externalId, last_error: null };
      results.succeeded++;
    } else if (outcome.kind === "retry") {
      update = { ...base, status: "pending", next_attempt_at: outcome.nextAttemptAt.toISOString(), last_error: outcome.error };
      results.retried++;
    } else {
      update = { ...base, status: "dead_letter", last_error: outcome.error };
      results.deadLettered++;
    }
    await db.from("ticket_jobs").update(update).eq("id", job.id).eq("status", "processing");
  }
  return results;
}
