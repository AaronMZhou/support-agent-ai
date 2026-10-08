import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { processBatch, requireUser, serviceClient } from "../_shared/queue.ts";

const Body = z.object({
  action: z.enum(["process", "requeue"]).default("process"),
  jobId: z.string().uuid().optional(),
  failRate: z.number().min(0).max(0.9).default(0),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await requireUser(req))) return json({ error: "Sign in required" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
  const db = serviceClient();

  if (parsed.data.action === "requeue") {
    if (!parsed.data.jobId) return json({ error: "jobId required" }, 400);
    const { error } = await db
      .from("ticket_jobs")
      .update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.jobId)
      .eq("status", "dead_letter");
    if (error) return json({ error: error.message }, 500);
  }

  try {
    const result = await processBatch(db, parsed.data.failRate);
    return json({ result });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
