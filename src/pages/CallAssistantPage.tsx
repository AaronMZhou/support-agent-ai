import { useState, useCallback } from "react";
import type { RequestStatus, QueryResponse, CallStage, PreviousRecommendation, IssueContext, TicketFields } from "@/lib/types";
import { sendQuery } from "@/lib/api-service";
import { DEMO_TRANSCRIPT } from "@/lib/mock-data";
import { CallSessionCard } from "@/components/call-assistant/CallSessionCard";
import { TranscriptCard } from "@/components/call-assistant/TranscriptCard";
import { IssueContextCard } from "@/components/call-assistant/IssueContextCard";
import { PreviousRecsCard } from "@/components/call-assistant/PreviousRecsCard";
import { AIRecommendationsCard } from "@/components/call-assistant/AIRecommendationsCard";
import { TicketDraftCard } from "@/components/call-assistant/TicketDraftCard";

export default function CallAssistantPage() {
  const [callId, setCallId] = useState("");
  const [techId, setTechId] = useState("");
  const [callStage, setCallStage] = useState<CallStage>("start");
  const [callActive, setCallActive] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [useMock, setUseMock] = useState(false);

  const [chunk, setChunk] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");

  const [issueCtx, setIssueCtx] = useState<Partial<IssueContext>>({});
  const [ticketFields, setTicketFields] = useState<Partial<TicketFields>>({});
  const [prevRecs, setPrevRecs] = useState<PreviousRecommendation[]>([]);

  const [aiResponse, setAiResponse] = useState<QueryResponse | null>(null);

  const startCall = useCallback(() => {
    const id = callId || `CALL-${Date.now()}`;
    setCallId(id);
    setCallActive(true);
    setCallStage("start");
    setAiResponse(null);
    setErrorMsg("");
    setStatus("idle");
  }, [callId]);

  const doQuery = useCallback(async (action: "analyze_transcript" | "continue_call" | "end_call") => {
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await sendQuery({
        action,
        callId,
        technicianId: techId || undefined,
        transcriptChunk: chunk,
        fullTranscriptSoFar: fullTranscript || undefined,
        callStage,
        issueContext: issueCtx,
        previousRecommendations: prevRecs.length ? prevRecs : undefined,
        ticketFields,
      }, useMock);
      setAiResponse(res);
      setStatus("success");
      if (action === "end_call") {
        setCallActive(false);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Request failed");
      setStatus("error");
    }
  }, [callId, techId, chunk, fullTranscript, callStage, issueCtx, prevRecs, ticketFields, useMock]);

  const appendChunk = useCallback(() => {
    if (!chunk.trim()) return;
    setFullTranscript(prev => (prev ? prev + "\n\n" + chunk : chunk));
    setChunk("");
  }, [chunk]);

  const loadFromAI = useCallback(() => {
    if (!aiResponse?.recommendedNextSteps) return;
    const newRecs: PreviousRecommendation[] = aiResponse.recommendedNextSteps.map(s => ({
      step: s.action,
      status: "not_tried",
    }));
    setPrevRecs(prev => [...prev, ...newRecs]);
  }, [aiResponse]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 max-w-[1600px] mx-auto">
      {/* LEFT COLUMN */}
      <div className="space-y-4">
        <CallSessionCard
          callId={callId} setCallId={setCallId}
          techId={techId} setTechId={setTechId}
          callStage={callStage} setCallStage={setCallStage}
          callActive={callActive}
          status={status} errorMsg={errorMsg}
          useMock={useMock} setUseMock={setUseMock}
          onStartCall={startCall}
          onAnalyze={() => doQuery("analyze_transcript")}
          onContinue={() => doQuery("continue_call")}
          onEndCall={() => doQuery("end_call")}
        />
        <TranscriptCard
          chunk={chunk} setChunk={setChunk}
          fullTranscript={fullTranscript} setFullTranscript={setFullTranscript}
          onAppend={appendChunk}
          onLoadDemo={() => setChunk(DEMO_TRANSCRIPT)}
        />
        <IssueContextCard
          ctx={issueCtx} setCtx={setIssueCtx}
          ticketFields={ticketFields} setTicketFields={setTicketFields}
        />
        <PreviousRecsCard
          recs={prevRecs} setRecs={setPrevRecs}
          onLoadFromAI={loadFromAI}
          hasAIResponse={!!aiResponse}
        />
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-4">
        <AIRecommendationsCard response={aiResponse} status={status} errorMsg={errorMsg} />
        <TicketDraftCard draft={aiResponse?.ticketDraft ?? null} />
      </div>
    </div>
  );
}
