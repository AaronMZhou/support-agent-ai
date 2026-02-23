import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Plus, Sparkles } from "lucide-react";

interface Props {
  chunk: string; setChunk: (v: string) => void;
  fullTranscript: string; setFullTranscript: (v: string) => void;
  onAppend: () => void;
  onLoadDemo: () => void;
}

export function TranscriptCard({ chunk, setChunk, fullTranscript, setFullTranscript, onAppend, onLoadDemo }: Props) {
  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          Transcript
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Current Transcript Chunk</Label>
            <span className="text-[10px] text-muted-foreground">{chunk.length} chars</span>
          </div>
          <Textarea
            value={chunk} onChange={e => setChunk(e.target.value)}
            placeholder="Paste or type transcript chunk..."
            className="min-h-[100px] text-sm font-mono"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={onAppend} disabled={!chunk.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Append to Full
            </Button>
            <Button size="sm" variant="outline" onClick={onLoadDemo}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Demo Transcript
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Full Transcript So Far</Label>
            <span className="text-[10px] text-muted-foreground">{fullTranscript.length} chars</span>
          </div>
          <Textarea
            value={fullTranscript} onChange={e => setFullTranscript(e.target.value)}
            placeholder="Accumulated transcript..."
            className="min-h-[80px] text-sm font-mono bg-muted/50"
          />
        </div>
      </CardContent>
    </Card>
  );
}
