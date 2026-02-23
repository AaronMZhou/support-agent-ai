import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Code, RotateCcw, ExternalLink } from "lucide-react";
import { API_CONFIG } from "@/lib/api-config";
import { getLogs, subscribeToLogs } from "@/lib/api-service";
import type { ApiLog } from "@/lib/types";

export default function DebugPage() {
  const [logs, setLogs] = useState<ApiLog[]>(getLogs());

  useEffect(() => {
    return subscribeToLogs(setLogs);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Endpoints */}
      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-accent" />
            API Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EndpointRow label="Query" url={API_CONFIG.QUERY_ENDPOINT} />
          <EndpointRow label="Ingest" url={API_CONFIG.INGEST_ENDPOINT} />
          <EndpointRow label="Transcribe" url={API_CONFIG.TRANSCRIBE_ENDPOINT || "(not configured)"} />
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Code className="h-4 w-4 text-accent" />
              API Request Log
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">{logs.length} entries</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No API calls yet. Make a request to see logs here.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EndpointRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="text-[10px] w-14 justify-center">{label}</Badge>
      <code className="text-xs font-mono text-muted-foreground break-all">{url}</code>
    </div>
  );
}

function LogEntry({ log }: { log: ApiLog }) {
  const [expanded, setExpanded] = useState(false);
  const isError = log.status === 0 || (log.status && log.status >= 400);
  const statusColor = isError ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-success/15 text-success border-success/30";

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
          {log.status ?? "ERR"}
        </Badge>
        <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{log.endpoint}</span>
        <span className="text-[10px] text-muted-foreground">{log.durationMs}ms</span>
        <span className="text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
      </button>
      {expanded && (
        <div className="border-t bg-muted/30 p-3 space-y-2">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Request</span>
            <pre className="text-xs font-mono mt-1 overflow-auto max-h-48 bg-card p-2 rounded border">{JSON.stringify(log.requestBody, null, 2)}</pre>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Response</span>
            <pre className="text-xs font-mono mt-1 overflow-auto max-h-48 bg-card p-2 rounded border">{JSON.stringify(log.responseBody, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
