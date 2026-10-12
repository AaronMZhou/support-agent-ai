// Transcribes short recorded audio segments (mic + computer audio) for a live call.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/queue.ts";

const MAX_BYTES = 20 * 1024 * 1024;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  if (!(await requireUser(req))) return json({ success: false, error: "Sign in required" }, 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ success: false, error: "Transcription is not configured" }, 500);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return json({ success: false, error: "Audio file required" }, 400);
  if (file.size > MAX_BYTES) return json({ success: false, error: "Audio segment too large" }, 413);

  const type = (file.type || "audio/webm").replace(/^video\//, "audio/").split(";")[0];
  const upstream = new FormData();
  upstream.append("model", "openai/gpt-transcribe");
  upstream.append("file", new File([await file.arrayBuffer()], file.name || "segment.webm", { type }));
  upstream.append("response_format", "json");
  upstream.append("prompt", "Live IT support phone call between a technician and a user.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Transcription failed [${res.status}]: ${body}`);
    let message = `Transcription failed (${res.status})`;
    try { message = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? message; } catch { /* keep default */ }
    return json({ success: false, error: message }, res.status);
  }
  let text = "";
  try { text = JSON.parse(body).text ?? ""; } catch { text = body; }
  return json({ success: true, text: String(text).trim() });
});
