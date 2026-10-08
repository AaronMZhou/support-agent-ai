// Stand-in for a real ticketing system. Honors Idempotency-Key and can inject
// failures, including "ticket saved but response lost".
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { pickFailure } from "../_shared/ticket-core.ts";
import { serviceClient } from "../_shared/queue.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Internal only: callers must present the service credential.
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth || auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "Forbidden" }, 403);

  const key = req.headers.get("Idempotency-Key");
  if (!key) return json({ error: "Idempotency-Key header required" }, 400);
  const body = await req.json().catch(() => null);
  if (!body?.callId || !body?.draft) return json({ error: "callId and draft required" }, 400);

  const failRate = Math.min(0.9, Math.max(0, Number(req.headers.get("X-Fail-Rate") ?? 0) || 0));
  const failure = pickFailure(failRate, Math.random);
  if (failure === "fail_before_write") return json({ error: "Injected failure before write" }, 503);

  const db = serviceClient();
  const { error } = await db.from("mock_tickets").upsert(
    { idempotency_key: key, external_id: `TKT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, call_id: body.callId, payload: body.draft },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (error) return json({ error: error.message }, 500);
  const { data: ticket } = await db.from("mock_tickets").select("external_id").eq("idempotency_key", key).single();

  if (failure === "fail_after_write") return json({ error: "Injected failure after write (response lost)" }, 502);
  return json({ externalId: ticket?.external_id });
});
