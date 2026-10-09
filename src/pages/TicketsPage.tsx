import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, RefreshCw, Play, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface JobRow {
  id: string;
  call_id: string;
  technician_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  edited: boolean;
  last_error: string | null;
  external_ticket_id: string | null;
  next_attempt_at: string;
  created_at: string;
  final_draft: { shortTitle?: string };
}

const statusStyle: Record<string, string> = {
  pending: "bg-info/15 text-info border-info/30",
  processing: "bg-info/15 text-info border-info/30",
  succeeded: "bg-success/15 text-success border-success/30",
  dead_letter: "bg-destructive/15 text-destructive border-destructive/30",
};
const statusLabel: Record<string, string> = { pending: "queued", processing: "sending", succeeded: "created", dead_letter: "failed" };

const WEEK = 7 * 24 * 3600 * 1000;

function weekStart(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export default function TicketsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ticketCalls, setTicketCalls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failPct, setFailPct] = useState(0);
  const autoRef = useRef(false);

  const load = useCallback(async () => {
    const [j, p, t] = await Promise.all([
      supabase.from("ticket_jobs").select("id,call_id,technician_id,status,attempts,max_attempts,edited,last_error,external_ticket_id,next_attempt_at,created_at,final_draft").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("id,display_name,email"),
      supabase.from("mock_tickets").select("call_id").limit(1000),
    ]);
    if (j.data) setJobs(j.data as JobRow[]);
    if (p.data) setNames(Object.fromEntries(p.data.map(x => [x.id, x.display_name || x.email || x.id.slice(0, 8)])));
    if (t.data) setTicketCalls(t.data.map(x => x.call_id));
    setLoading(false);
  }, []);

  const runQueue = useCallback(async (body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("process-ticket-queue", {
      body: { action: "process", failRate: failPct / 100, ...body },
    });
    if (error || data?.error) toast.error(data?.error ?? error?.message ?? "Queue run failed");
    await load();
    return data?.result;
  }, [failPct, load]);

  useEffect(() => { load(); }, [load]);

  // While this page is open and retries are due, run the queue every 10s.
  const hasPending = jobs.some(j => j.status === "pending" || j.status === "processing");
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(async () => {
      if (autoRef.current) return;
      autoRef.current = true;
      try { await runQueue(); } finally { autoRef.current = false; }
    }, 10_000);
    return () => clearInterval(t);
  }, [hasPending, runQueue]);

  const metrics = useMemo(() => {
    const done = jobs.filter(j => j.status === "succeeded");
    const thisWeek = weekStart(new Date()).getTime();
    const weeks: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = thisWeek - i * WEEK;
      weeks.push({
        label: new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: done.filter(j => { const t = new Date(j.created_at).getTime(); return t >= start && t < start + WEEK; }).length,
      });
    }
    const recent = done.filter(j => Date.now() - new Date(j.created_at).getTime() < 28 * 24 * 3600 * 1000);
    const perCall = new Map<string, number>();
    ticketCalls.forEach(c => perCall.set(c, (perCall.get(c) ?? 0) + 1));
    return {
      thisWeek: weeks[weeks.length - 1].count,
      weeks,
      techs30: new Set(recent.map(j => j.technician_id)).size,
      techsAll: new Set(jobs.map(j => j.technician_id)).size,
      acceptedShare: done.length ? Math.round((done.filter(j => !j.edited).length / done.length) * 100) : null,
      total: done.length,
      dead: jobs.filter(j => j.status === "dead_letter").length,
      queued: jobs.filter(j => j.status === "pending" || j.status === "processing").length,
      duplicates: [...perCall.values()].filter(n => n > 1).length,
    };
  }, [jobs, ticketCalls]);

  const maxWeek = Math.max(1, ...metrics.weeks.map(w => w.count));

  const act = async (body?: Record<string, unknown>) => {
    setBusy(true);
    const r = await runQueue(body);
    setBusy(false);
    if (r) toast.success(`Processed ${r.claimed}: ${r.succeeded} created, ${r.retried} retrying, ${r.deadLettered} failed`);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Tickets this week" value={metrics.thisWeek} />
        <Stat label="Tickets total" value={metrics.total} />
        <Stat label="Technicians (30d)" value={metrics.techs30} hint={`${metrics.techsAll} all time`} />
        <Stat label="Accepted without edits" value={metrics.acceptedShare === null ? "—" : `${metrics.acceptedShare}%`} />
        <Stat label="Queued / retrying" value={metrics.queued} />
        <Stat label="Failed (dead letter)" value={metrics.dead} tone={metrics.dead ? "bad" : undefined} />
        <Stat label="Duplicate tickets" value={metrics.duplicates} tone={metrics.duplicates ? "bad" : "good"} />
      </div>

      <Card className="dashboard-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tickets per week</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-28">
            {metrics.weeks.map(w => (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{w.count}</span>
                <div className="w-full rounded-t bg-accent/70" style={{ height: `${(w.count / maxWeek) * 80}px`, minHeight: 2 }} />
                <span className="text-[10px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Counted from real submissions in this app. Weeks start Monday (UTC).</p>
        </CardContent>
      </Card>

      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Ticket className="h-4 w-4 text-accent" /> Ticket Queue
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Inject failures</Label>
              <Input type="number" min={0} max={90} value={failPct} onChange={e => setFailPct(Math.min(90, Math.max(0, Number(e.target.value) || 0)))} className="h-8 w-16 text-sm" />
              <span className="text-xs text-muted-foreground">%</span>
              <Button size="sm" variant="secondary" onClick={() => act()} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />} Process queue
              </Button>
              <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          {hasPending && <p className="text-[11px] text-muted-foreground">Retries run automatically every 10 seconds while this page is open.</p>}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No tickets yet. Submit one from the Call Assistant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Call</th>
                    <th className="py-2 pr-3 font-medium">Technician</th>
                    <th className="py-2 pr-3 font-medium">Tries</th>
                    <th className="py-2 pr-3 font-medium">Edited</th>
                    <th className="py-2 pr-3 font-medium">Ticket / last error</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3"><Badge variant="outline" className={`text-[10px] ${statusStyle[j.status] ?? ""}`}>{statusLabel[j.status] ?? j.status}</Badge></td>
                      <td className="py-2 pr-3 max-w-[220px] truncate">{j.final_draft?.shortTitle ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{j.call_id}</td>
                      <td className="py-2 pr-3 text-xs">{names[j.technician_id] ?? j.technician_id.slice(0, 8)}</td>
                      <td className="py-2 pr-3 text-xs">{j.attempts}/{j.max_attempts}</td>
                      <td className="py-2 pr-3 text-xs">{j.edited ? "yes" : "no"}</td>
                      <td className="py-2 pr-3 text-xs max-w-[260px]">
                        {j.external_ticket_id
                          ? <span className="font-mono">{j.external_ticket_id}</span>
                          : <span className="text-muted-foreground break-words">{j.last_error ?? ""}{j.status === "pending" && j.attempts > 0 ? ` · next try ${new Date(j.next_attempt_at).toLocaleTimeString()}` : ""}</span>}
                      </td>
                      <td className="py-2 text-right">
                        {j.status === "dead_letter" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => act({ action: "requeue", jobId: j.id })}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "good" | "bad" }) {
  return (
    <Card className="dashboard-card">
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-success" : ""}`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
