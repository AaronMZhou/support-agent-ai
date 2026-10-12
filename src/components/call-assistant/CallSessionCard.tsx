import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, Play, RotateCcw, Loader2, Mic, MicOff, MonitorSpeaker } from "lucide-react";
import type { CallStage, RequestStatus } from "@/lib/types";

type TranscriptionMode = "api" | "browser";

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
  listening: boolean;
  processing: boolean;
  transcriptionMode: TranscriptionMode;
  setTranscriptionMode: (value: TranscriptionMode) => void;
  includeSystemAudio: boolean;
  setIncludeSystemAudio: (value: boolean) => void;
  autoStartOnCall: boolean;
  setAutoStartOnCall: (value: boolean) => void;
  endpointConfigured: boolean;
  captureSupported: boolean;
  browserSpeechSupported: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
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
  listening, processing,
  transcriptionMode, setTranscriptionMode,
  includeSystemAudio, setIncludeSystemAudio,
  autoStartOnCall, setAutoStartOnCall,
  endpointConfigured, captureSupported, browserSpeechSupported,
  onStartListening, onStopListening,
}: Props) {
  const loading = status === "sending";
  const useApiMode = transcriptionMode === "api";
  const canStartListening = !listening && (
    (useApiMode && endpointConfigured && captureSupported) ||
    (!useApiMode && browserSpeechSupported)
  );

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-accent" />
            Call Session
          </CardTitle>
          <div className="flex items-center gap-2">
            {listening && (
              <Badge variant="outline" className={processing
                ? "bg-info/15 text-info border-info/30"
                : "bg-success/15 text-success border-success/30"}>
                {processing ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Listening</>
                ) : "Listening"}
              </Badge>
            )}
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

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <Label className="text-xs">Audio Source</Label>
            <Select
              value={transcriptionMode}
              onValueChange={(value) => setTranscriptionMode(value as TranscriptionMode)}
              disabled={listening}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="api">Mic + computer audio</SelectItem>
                <SelectItem value="browser">Mic only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-start-capture"
              checked={autoStartOnCall}
              onCheckedChange={setAutoStartOnCall}
              disabled={listening}
              className="scale-75"
            />
            <Label htmlFor="auto-start-capture" className="text-xs text-muted-foreground cursor-pointer">
              Start listening with call
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="include-system-audio"
              checked={includeSystemAudio}
              onCheckedChange={setIncludeSystemAudio}
              disabled={listening || !useApiMode}
              className="scale-75"
            />
            <Label htmlFor="include-system-audio" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              <MonitorSpeaker className="h-3.5 w-3.5" />
              Include computer audio (the caller)
            </Label>
          </div>
        </div>

        {useApiMode && (
          <p className="text-[11px] text-muted-foreground">
            When asked, pick the screen, window or tab where the call is playing and turn on "Share audio". On Windows, sharing the entire screen captures all computer audio. Text appears about every 6 seconds.
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
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
          <Button
            size="sm"
            variant={listening ? "outline" : "secondary"}
            onClick={listening ? onStopListening : onStartListening}
            disabled={listening ? false : !canStartListening}
          >
            {listening ? <MicOff className="h-3.5 w-3.5 mr-1" /> : <Mic className="h-3.5 w-3.5 mr-1" />}
            {listening ? "Stop Listening" : "Start Listening"}
          </Button>
        </div>

        {/* Mock toggle */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Switch id="mock" checked={useMock} onCheckedChange={setUseMock} className="scale-75" />
          <Label htmlFor="mock" className="text-xs text-muted-foreground cursor-pointer">Use mock response if API fails</Label>
        </div>

        {useApiMode && !captureSupported && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            Browser audio capture APIs are not available in this browser.
          </div>
        )}

        {useApiMode && !endpointConfigured && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            Transcription endpoint is not configured.
          </div>
        )}

        {!useApiMode && !browserSpeechSupported && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            Browser Speech Recognition is not supported in this browser.
          </div>
        )}

        {errorMsg && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {errorMsg}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
