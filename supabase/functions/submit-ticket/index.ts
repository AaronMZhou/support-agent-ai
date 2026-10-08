import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { idempotencyKey, isDraftEdited, parseTicketDraft, DraftParseError } from "../_shared/ticket-core.ts";
import { processBatch, requireUser, serviceClient } from "../_shared/queue.ts";

const Body = z.object({
  callId: z.string().min(1).max(200),
  aiDraft: z.unknown(),
  finalDraft: z.unknown(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const userId = await requireUser(req);
  if (!userId) return json({ error: "Sign in required" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);

  let aiDraft, finalDraft;
  try {
    aiDraft = parseTicketDraft(parsed.data.aiDraft);
    finalDraft = parseTicketDraft(parsed.data.finalDraft);
  } catch (e) {
    if (e instanceof DraftParseError) return json({ error: e.message }, 400);
    throw e;
  }

  const db = serviceClient();
  const key = idempotencyKey(parsed.data.callId, userId);

  // Idempotent enqueue: a second submit for the same call returns the existing job.
  const { error: insertError } = await db.from("ticket_jobs").upsert(
    {
      idempotency_key: key,
      call_id: parsed.data.callId,
      technician_id: userId,
      ai_draft: aiDraft,
      final_draft: finalDraft,
      edited: isDraftEdited(aiDraft, finalDraft),
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (insertError) return json({ error: "Could not queue ticket", details: insertError.message }, 500);

  try {
    await processBatch(db);
  } catch (e) {
    console.error("processBatch after enqueue failed", e);
  }

  const { data: job } = await db.from("ticket_jobs").select("*").eq("idempotency_key", key).single();
  return json({ job });
});
