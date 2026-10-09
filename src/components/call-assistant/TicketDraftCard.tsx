import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Copy, FileJson, Send, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TicketDraft, ResolutionStatus } from "@/lib/types";

interface Props {
  draft: TicketDraft | null;
  callId: string;
}

const statusColors: Record<string, string> = {
  unresolved: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
  workaround_provided: "bg-info/15 text-info border-info/30",
  escalate: "bg-destructive/15 text-destructive border-destructive/30",
  pending: "bg-info/15 text-info border-info/30",
  processing: "bg-info/15 text-info border-info/30",
  succeeded: "bg-success/15 text-success border-success/30",
  dead_letter: "bg-destructive/15 text-destructive border-destructive/30",
};

const jobLabels: Record<string, string> = {
  pending: "Queued, retrying",
  processing: "Sending",
  succeeded: "Ticket created",
  dead_letter: "Failed",
};

interface JobState { status: string; external_ticket_id: string | null; last_error: string | null; attempts: number }

function toPlainText(d: TicketDraft) {
  return `TICKET: ${d.shortTitle}
Category: ${d.category}
Status: ${d.resolutionStatus}

PROBLEM SUMMARY:
${d.problemSummary}

OBSERVED SYMPTOMS:
${d.observedSymptoms.map(s => `• ${s}`).join("\n")}

STEPS ATTEMPTED:
${d.stepsAttempted.map(s => `• ${s}`).join("\n")}

RECOMMENDED NEXT ACTION:
${d.recommendedNextAction}

NOTES:
${d.notes}`;
}

const lines = (s: string) => s.split("\n").map(x => x.trim()).filter(Boolean);

export function TicketDraftCard({ draft, callId }: Props) {
  const [edit, setEdit] = useState<TicketDraft | null>(draft);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);

  useEffect(() => { setEdit(draft); setJob(null); }, [draft]);

  if (!draft || !edit) {
    return (
      <Card className="dashboard-card">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <Ticket className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Ticket draft will appear after AI analysis.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof TicketDraft>(k: K, v: TicketDraft[K]) => setEdit({ ...edit, [k]: v });
  const changed = JSON.stringify(edit) !== JSON.stringify(draft);
  const locked = !!job && job.status !== "dead_letter";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const submit = async () => {
    if (!callId) { toast.error("Start a call first so the ticket has a call ID."); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-ticket", {
      body: { callId, aiDraft: draft, finalDraft: edit },
    });
    setSubmitting(false);
    if (error || !data?.job) {
      toast.error(data?.error ?? error?.message ?? "Could not submit ticket");
      return;
    }
    setJob(data.job);
    if (data.job.status === "succeeded") toast.success(`Ticket ${data.job.external_ticket_id} created`);
    else toast.info("Ticket queued. It will be retried automatically.");
  };

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Ticket className="h-4 w-4 text-accent" />
            Ticket Draft
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {changed && <Badge variant="outline" className="text-[10px]">edited</Badge>}
            <Badge variant="outline" className={`text-[10px] ${statusColors[edit.resolutionStatus] ?? ""}`}>
              {edit.resolutionStatus.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">AI-filled. Review and edit before submitting.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <F label="Title"><Input disabled={locked} value={edit.shortTitle} onChange={e => set("shortTitle", e.target.value)} className="h-8 text-sm" /></F>
        <div className="grid grid-cols-2 gap-2">
          <F label="Category"><Input disabled={locked} value={edit.category} onChange={e => set("category", e.target.value)} className="h-8 text-sm" /></F>
          <F label="Resolution Status">
            <Select disabled={locked} value={edit.resolutionStatus} onValueChange={v => set("resolutionStatus", v as ResolutionStatus)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="workaround_provided">Workaround provided</SelectItem>
                <SelectItem value="escalate">Escalate</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </div>
        <F label="Problem Summary"><Textarea disabled={locked} value={edit.problemSummary} onChange={e => set("problemSummary", e.target.value)} className="text-sm min-h-[60px]" /></F>
        <F label="Observed Symptoms (one per line)"><Textarea disabled={locked} value={edit.observedSymptoms.join("\n")} onChange={e => set("observedSymptoms", lines(e.target.value))} className="text-sm min-h-[60px]" /></F>
        <F label="Steps Attempted (one per line)"><Textarea disabled={locked} value={edit.stepsAttempted.join("\n")} onChange={e => set("stepsAttempted", lines(e.target.value))} className="text-sm min-h-[60px]" /></F>
        <F label="Recommended Next Action"><Input disabled={locked} value={edit.recommendedNextAction} onChange={e => set("recommendedNextAction", e.target.value)} className="h-8 text-sm" /></F>
        <F label="Notes"><Textarea disabled={locked} value={edit.notes} onChange={e => set("notes", e.target.value)} className="text-sm min-h-[50px]" /></F>

        {job && (
          <div className="rounded-md border px-3 py-2 text-xs flex items-center justify-between gap-2">
            <Badge variant="outline" className={`text-[10px] ${statusColors[job.status] ?? ""}`}>{jobLabels[job.status] ?? job.status}</Badge>
            <span className="text-muted-foreground truncate">
              {job.external_ticket_id ? `Ticket ${job.external_ticket_id}` : job.last_error ?? ""} · {job.attempts} attempt{job.attempts === 1 ? "" : "s"}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" onClick={submit} disabled={submitting || locked} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Submit Ticket
          </Button>
          {changed && !locked && (
            <Button size="sm" variant="ghost" onClick={() => setEdit(draft)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset to AI draft
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => copy(toPlainText(edit), "Ticket draft")}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(JSON.stringify(edit, null, 2), "JSON")}>
            <FileJson className="h-3.5 w-3.5 mr-1" /> Copy JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
