import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Upload, Sparkles, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ingestArticle } from "@/lib/api-service";
import { DEMO_ARTICLE } from "@/lib/mock-data";
import type { IngestResponse, RequestStatus } from "@/lib/types";

export default function KnowledgeBasePage() {
  const [articleId, setArticleId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [content, setContent] = useState("");
  const [useMock, setUseMock] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [response, setResponse] = useState<IngestResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadDemo = () => {
    setArticleId(DEMO_ARTICLE.articleId);
    setTitle(DEMO_ARTICLE.title);
    setCategory(DEMO_ARTICLE.category);
    setTags(DEMO_ARTICLE.tags);
    setSourceUrl(DEMO_ARTICLE.sourceUrl);
    setContent(DEMO_ARTICLE.content);
    setLastUpdated("");
  };

  const clearForm = () => {
    setArticleId(""); setTitle(""); setCategory(""); setTags("");
    setSourceUrl(""); setLastUpdated(""); setContent("");
    setResponse(null); setErrorMsg(""); setStatus("idle");
  };

  const submit = async () => {
    if (!articleId || !title || !content) {
      setErrorMsg("Article ID, Title, and Content are required.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await ingestArticle({
        articleId, title, content,
        category: category || undefined,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
        sourceUrl: sourceUrl || undefined,
        lastUpdated: lastUpdated || undefined,
      }, useMock);
      setResponse(res);
      setStatus("success");
    } catch (e: any) {
      setErrorMsg(e.message || "Ingestion failed");
      setStatus("error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            Ingest Support Article
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Article ID *</Label>
              <Input value={articleId} onChange={e => setArticleId(e.target.value)} className="h-8 text-sm" placeholder="e.g. KB-001" />
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" placeholder="Article title" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} className="h-8 text-sm" placeholder="e.g. Email" />
            </div>
            <div>
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input value={tags} onChange={e => setTags(e.target.value)} className="h-8 text-sm" placeholder="outlook, crash" />
            </div>
            <div>
              <Label className="text-xs">Source URL</Label>
              <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className="h-8 text-sm" placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Last Updated</Label>
              <Input type="date" value={lastUpdated} onChange={e => setLastUpdated(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Article Content *</Label>
              <span className="text-[10px] text-muted-foreground">{content.length} chars</span>
            </div>
            <Textarea value={content} onChange={e => setContent(e.target.value)} className="min-h-[200px] text-sm font-mono" placeholder="Paste article content here..." />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="mock-kb" checked={useMock} onCheckedChange={setUseMock} className="scale-75" />
            <Label htmlFor="mock-kb" className="text-xs text-muted-foreground cursor-pointer">Use mock response</Label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={status === "sending"} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {status === "sending" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Ingest Article
            </Button>
            <Button size="sm" variant="outline" onClick={loadDemo}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Load Example
            </Button>
            <Button size="sm" variant="ghost" onClick={clearForm}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          </div>

          {errorMsg && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Card */}
      {response && (
        <Card className="dashboard-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {"success" in response && response.success ? (
                <><CheckCircle2 className="h-4 w-4 text-success" /> Ingestion Result</>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /> Ingestion Error</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {"success" in response && response.success ? (
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30">Success</Badge>
                </div>
                <p><span className="text-muted-foreground">Article:</span> {response.title} ({response.articleId})</p>
                <p><span className="text-muted-foreground">Chunks Created:</span> {response.chunksCreated}</p>
                <p><span className="text-muted-foreground">Message:</span> {response.message}</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Error</Badge>
                <pre className="font-mono text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(response, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
