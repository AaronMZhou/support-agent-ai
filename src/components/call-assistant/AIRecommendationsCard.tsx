import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, AlertTriangle, BookOpen, HelpCircle, ArrowUpCircle } from "lucide-react";
import type { QueryResponse, RequestStatus, RiskLevel } from "@/lib/types";

interface Props {
  response: QueryResponse | null;
  status: RequestStatus;
  errorMsg: string;
}

const riskColors: Record<RiskLevel, string> = {
  low: "bg-risk-low/15 text-risk-low border-risk-low/30",
  medium: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  high: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

export function AIRecommendationsCard({ response, status, errorMsg }: Props) {
  if (status === "sending") {
    return (
      <Card className="dashboard-card">
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Brain className="h-8 w-8 text-accent mx-auto animate-pulse" />
            <p className="text-sm text-muted-foreground">Analyzing transcript...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!response) {
    return (
      <Card className="dashboard-card">
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <Brain className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">AI recommendations will appear here after analysis.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidencePct = Math.round(response.confidence * 100);

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Issue Summary */}
        <div className="rounded-md bg-accent/10 border border-accent/20 p-3">
          <p className="text-sm font-medium">{response.issueSummary}</p>
        </div>

        {/* Confidence & Escalation */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <span className="text-xs font-semibold">{confidencePct}%</span>
            </div>
            <Progress value={confidencePct} className="h-2" />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpCircle className={`h-4 w-4 ${response.escalationRecommendation.shouldEscalate ? "text-destructive" : "text-success"}`} />
            <span className="text-xs font-medium">
              {response.escalationRecommendation.shouldEscalate ? "Escalate" : "No Escalation"}
            </span>
          </div>
        </div>
        {response.escalationRecommendation.reason && (
          <p className="text-xs text-muted-foreground -mt-2">{response.escalationRecommendation.reason}</p>
        )}

        {/* Likely Causes */}
        <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Likely Causes">
          <div className="space-y-1.5">
            {response.likelyCauses.map((c, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">#{c.rank}</span>
                <div>
                  <span className="font-medium">{c.cause}</span>
                  <span className="text-muted-foreground"> — {c.why}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Recommended Steps */}
        <Section icon={<ArrowUpCircle className="h-3.5 w-3.5" />} title="Recommended Next Steps">
          <div className="space-y-2">
            {response.recommendedNextSteps.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 pt-0.5">{s.stepNumber}.</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.action}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[s.riskLevel]}`}>
                      {s.riskLevel}
                    </Badge>
                    {s.requiresConfirmation && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">confirm</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Clarifying Questions */}
        {response.clarifyingQuestions.length > 0 && (
          <Section icon={<HelpCircle className="h-3.5 w-3.5" />} title="Clarifying Questions">
            <ul className="space-y-1">
              {response.clarifyingQuestions.map((q, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-accent">•</span> {q}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Documentation References */}
        {response.documentationReferences.length > 0 && (
          <Section icon={<BookOpen className="h-3.5 w-3.5" />} title="Documentation References">
            <div className="space-y-1.5">
              {response.documentationReferences.map((d, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">({d.articleId})</span>
                  <p className="text-xs text-muted-foreground">{d.relevance}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-accent">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}
