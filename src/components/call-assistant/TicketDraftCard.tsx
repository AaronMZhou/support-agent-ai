import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, Copy, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import type { TicketDraft } from "@/lib/types";

interface Props {
  draft: TicketDraft | null;
}

const statusColors: Record<string, string> = {
  unresolved: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
  workaround_provided: "bg-info/15 text-info border-info/30",
  escalate: "bg-destructive/15 text-destructive border-destructive/30",
};

export function TicketDraftCard({ draft }: Props) {
  if (!draft) {
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

  const plainText = `TICKET: ${draft.shortTitle}
Category: ${draft.category}
Status: ${draft.resolutionStatus}

PROBLEM SUMMARY:
${draft.problemSummary}

OBSERVED SYMPTOMS:
${draft.observedSymptoms.map(s => `• ${s}`).join("\n")}

STEPS ATTEMPTED:
${draft.stepsAttempted.map(s => `• ${s}`).join("\n")}

RECOMMENDED NEXT ACTION:
${draft.recommendedNextAction}

NOTES:
${draft.notes}`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Ticket className="h-4 w-4 text-accent" />
            Ticket Draft
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] ${statusColors[draft.resolutionStatus] ?? ""}`}>
            {draft.resolutionStatus.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Title" value={draft.shortTitle} />
        <Field label="Category" value={draft.category} />
        <Field label="Problem Summary" value={draft.problemSummary} />
        <ListField label="Observed Symptoms" items={draft.observedSymptoms} />
        <ListField label="Steps Attempted" items={draft.stepsAttempted} />
        <Field label="Recommended Next Action" value={draft.recommendedNextAction} />
        <Field label="Notes" value={draft.notes} />

        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="secondary" onClick={() => copy(plainText, "Ticket draft")}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy Draft
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(JSON.stringify(draft, null, 2), "JSON")}>
            <FileJson className="h-3.5 w-3.5 mr-1" /> Copy JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(plainText, "Plain text")}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Plain Text
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ul className="mt-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm flex gap-2"><span className="text-accent">•</span>{item}</li>
        ))}
      </ul>
    </div>
  );
}
