import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import type { IssueContext, TicketFields } from "@/lib/types";

interface Props {
  ctx: Partial<IssueContext>; setCtx: (v: Partial<IssueContext>) => void;
  ticketFields: Partial<TicketFields>; setTicketFields: (v: Partial<TicketFields>) => void;
}

export function IssueContextCard({ ctx, setCtx, ticketFields, setTicketFields }: Props) {
  const update = (key: keyof IssueContext, val: string) => setCtx({ ...ctx, [key]: val });
  const updateTF = (key: keyof TicketFields, val: string) => setTicketFields({ ...ticketFields, [key]: val });

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4 text-accent" />
          Issue Context & Ticket Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Device Type" value={ctx.deviceType ?? ""} onChange={v => update("deviceType", v)} />
          <Field label="OS" value={ctx.os ?? ""} onChange={v => update("os", v)} />
          <Field label="Software (comma-sep)" value={Array.isArray(ctx.software) ? ctx.software.join(", ") : (ctx.software ?? "")} onChange={v => setCtx({ ...ctx, software: v.split(",").map(s => s.trim()).filter(Boolean) })} />
          <Field label="User Problem" value={ctx.userReportedProblem ?? ""} onChange={v => update("userReportedProblem", v)} />
          <Field label="Error Messages (comma-sep)" value={Array.isArray(ctx.errorMessages) ? ctx.errorMessages.join(", ") : (ctx.errorMessages ?? "")} onChange={v => setCtx({ ...ctx, errorMessages: v.split(",").map(s => s.trim()).filter(Boolean) })} />
          <Field label="Location" value={ctx.location ?? ""} onChange={v => update("location", v)} />
          <Field label="Requester Name" value={ticketFields.requesterName ?? ""} onChange={v => updateTF("requesterName", v)} />
          <Field label="Department" value={ticketFields.department ?? ""} onChange={v => updateTF("department", v)} />
          <Field label="Priority" value={ticketFields.priority ?? ""} onChange={v => updateTF("priority", v)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-8 text-sm" placeholder={label} />
    </div>
  );
}
