import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, AudioLines, MonitorSpeaker } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TranscriptionMode = "api" | "browser";

interface Props {
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
  lastSnippet: string;
  errorMsg: string;
  onStart: () => void;
  onStop: () => void;
}

export function LiveCaptureCard({
  listening,
  processing,
  transcriptionMode,
  setTranscriptionMode,
  includeSystemAudio,
  setIncludeSystemAudio,
  autoStartOnCall,
  setAutoStartOnCall,
  endpointConfigured,
  captureSupported,
  browserSpeechSupported,
  lastSnippet,
  errorMsg,
  onStart,
  onStop,
}: Props) {
  const useApiMode = transcriptionMode === "api";
  const canStart = !listening && (
    (useApiMode && endpointConfigured && captureSupported) ||
    (!useApiMode && browserSpeechSupported)
  );

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AudioLines className="h-4 w-4 text-accent" />
          Live Audio Capture (Beta)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={listening ? "bg-success/15 text-success border-success/30" : ""}>
            {listening ? "Listening" : "Stopped"}
          </Badge>
          {processing && (
            <Badge variant="outline" className="bg-info/15 text-info border-info/30">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Processing
            </Badge>
          )}
        </div>

        <div>
          <Label className="text-xs">Transcription Mode</Label>
          <Select
            value={transcriptionMode}
            onValueChange={(value) => setTranscriptionMode(value as TranscriptionMode)}
            disabled={listening}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="api">API (audio chunks, supports system audio)</SelectItem>
              <SelectItem value="browser">Browser Speech (free, mic only)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="auto-start-capture"
            checked={autoStartOnCall}
            onCheckedChange={setAutoStartOnCall}
            disabled={listening}
            className="scale-75"
          />
          <Label htmlFor="auto-start-capture" className="text-xs text-muted-foreground cursor-pointer">
            Auto-start listening when call starts
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
            Include system/tab audio
          </Label>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {useApiMode
            ? "For system audio capture, select a browser tab/window and enable audio sharing in the browser prompt."
            : "Browser Speech mode uses native speech recognition and listens to microphone input only."}
        </p>

        <div className="flex gap-2">
          <Button size="sm" onClick={onStart} disabled={!canStart}>
            <Mic className="h-3.5 w-3.5 mr-1" />
            Start Listening
          </Button>
          <Button size="sm" variant="outline" onClick={onStop} disabled={!listening}>
            <MicOff className="h-3.5 w-3.5 mr-1" />
            Stop
          </Button>
        </div>

        {useApiMode && !captureSupported && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            Browser audio capture APIs are not available in this browser.
          </div>
        )}

        {useApiMode && !endpointConfigured && (
          <div className="rounded-md bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning">
            Transcription endpoint is not configured. Set <code className="font-mono">VITE_TRANSCRIBE_ENDPOINT</code>.
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

        {lastSnippet && (
          <div className="rounded-md bg-muted/50 border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Last Captured Snippet</p>
            <p className="text-xs font-mono">{lastSnippet}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
