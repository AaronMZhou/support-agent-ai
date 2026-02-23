import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Plus, Trash2, Download } from "lucide-react";
import type { PreviousRecommendation, StepStatus } from "@/lib/types";

interface Props {
  recs: PreviousRecommendation[];
  setRecs: (v: PreviousRecommendation[]) => void;
  onLoadFromAI: () => void;
  hasAIResponse: boolean;
}

export function PreviousRecsCard({ recs, setRecs, onLoadFromAI, hasAIResponse }: Props) {
  const add = () => setRecs([...recs, { step: "", status: "not_tried" }]);
  const remove = (i: number) => setRecs(recs.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof PreviousRecommendation, val: string) => {
    const copy = [...recs];
    copy[i] = { ...copy[i], [field]: val };
    setRecs(copy);
  };

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" />
            Previous Recommendations
          </CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={add} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
            {hasAIResponse && (
              <Button size="sm" variant="outline" onClick={onLoadFromAI} className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" /> Load from AI
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No previous steps tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {recs.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={r.step} onChange={e => update(i, "step", e.target.value)} className="h-8 text-sm flex-1" placeholder="Step description..." />
                <Select value={r.status} onValueChange={v => update(i, "status", v as StepStatus)}>
                  <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_tried">Not Tried</SelectItem>
                    <SelectItem value="tried">Tried</SelectItem>
                    <SelectItem value="worked">Worked</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => remove(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
