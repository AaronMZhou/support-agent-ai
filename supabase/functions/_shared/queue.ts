import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createTicketOverHttp, outcomePatch, runBatch, type ClaimedJob, type JobStore } from "./ticket-core.ts";

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

// 10 jobs at a 10s API timeout each must finish inside one lease.
const MAX_BATCH = 10;
const LEASE_SECONDS = 120;

function supabaseStore(db: SupabaseClient): JobStore {
  return {
    async claim(limit, leaseSeconds) {
      const { data, error } = await db.rpc("claim_ticket_jobs", { p_limit: limit, p_lease_seconds: leaseSeconds });
      if (error) throw new Error(`Claim failed: ${error.message}`);
      return (data ?? []) as ClaimedJob[];
    },
    async save(job, outcome) {
      const { error } = await db
        .from("ticket_jobs")
        .update(outcomePatch(outcome, new Date()))
        .eq("id", job.id)
        .eq("status", "processing");
      if (error) throw new Error(`Save failed: ${error.message}`);
    },
  };
}

/** Claim and process one bounded batch against the ticketing API. */
export function processBatch(db: SupabaseClient, failRate = 0) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mock-ticketing-api`;
  const headers = {
    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    "X-Fail-Rate": String(failRate),
  };
  return runBatch(
    supabaseStore(db),
    { createTicket: (key, payload) => createTicketOverHttp(url, key, payload, { headers }) },
    { limit: MAX_BATCH, leaseSeconds: LEASE_SECONDS },
  );
}
