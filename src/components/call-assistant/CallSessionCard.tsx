import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Phone, PhoneOff, Play, RotateCcw, Loader2 } from "lucide-react";
import type { CallStage, RequestStatus } from "@/lib/types";

interface Props {
  callId: string; setCallId: (v: string) => void;
  techId: string; setTechId: (v: string) => void;
  callStage: CallStage; setCallStage: (v: CallStage) => void;
  callActive: boolean;
  status: RequestStatus; errorMsg: string;
  useMock: boolean; setUseMock: (v: boolean) => void;
  onStartCall: () => void;
  onAnalyze: () => void;
  onContinue: () => void;
  onEndCall: () => void;
}

const statusColors: Record<RequestStatus, string> = {
  idle: "bg-status-idle",
  sending: "bg-status-sending animate-pulse-dot",
  success: "bg-status-success",
  error: "bg-status-error",
};

export function CallSessionCard({
  callId, setCallId, techId, setTechId, callStage, setCallStage,
  callActive, status, errorMsg, useMock, setUseMock,
  onStartCall, onAnalyze, onContinue, onEndCall,
}: Props) {
  const loading = status === "sending";

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-accent" />
            Call Session
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
            <span className="text-xs text-muted-foreground capitalize">{status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Call ID</Label>
            <Input value={callId} onChange={e => setCallId(e.target.value)} placeholder="Auto-generated" className="h-8 text-sm" disabled={callActive} />
          </div>
          <div>
            <Label className="text-xs">Technician ID</Label>
            <Input value={techId} onChange={e => setTechId(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Call Stage</Label>
          <Select value={callStage} onValueChange={v => setCallStage(v as CallStage)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="start">Start</SelectItem>
              <SelectItem value="middle">Middle</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="end">End</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {!callActive ? (
            <Button size="sm" onClick={onStartCall} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Phone className="h-3.5 w-3.5 mr-1" /> Start Call
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={onAnalyze} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                Analyze
              </Button>
              <Button size="sm" variant="secondary" onClick={onContinue} disabled={loading}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Continue
              </Button>
              <Button size="sm" variant="destructive" onClick={onEndCall} disabled={loading}>
                <PhoneOff className="h-3.5 w-3.5 mr-1" /> End Call
              </Button>
            </>
          )}
        </div>

        {/* Mock toggle */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Switch id="mock" checked={useMock} onCheckedChange={setUseMock} className="scale-75" />
          <Label htmlFor="mock" className="text-xs text-muted-foreground cursor-pointer">Use mock response if API fails</Label>
        </div>

        {errorMsg && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {errorMsg}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
