import { useState, useCallback, useRef, useEffect } from "react";
import type { RequestStatus, QueryResponse, CallStage, PreviousRecommendation, IssueContext, TicketFields } from "@/lib/types";
import { sendQuery, transcribeAudioChunk } from "@/lib/api-service";
import { API_CONFIG } from "@/lib/api-config";
import { DEMO_TRANSCRIPT } from "@/lib/mock-data";
import { CallSessionCard } from "@/components/call-assistant/CallSessionCard";
import { TranscriptCard } from "@/components/call-assistant/TranscriptCard";
import { IssueContextCard } from "@/components/call-assistant/IssueContextCard";
import { PreviousRecsCard } from "@/components/call-assistant/PreviousRecsCard";
import { AIRecommendationsCard } from "@/components/call-assistant/AIRecommendationsCard";
import { TicketDraftCard } from "@/components/call-assistant/TicketDraftCard";
import { LiveCaptureCard } from "@/components/call-assistant/LiveCaptureCard";

type TranscriptionMode = "api" | "browser";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

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
  const [captureListening, setCaptureListening] = useState(false);
  const [captureProcessing, setCaptureProcessing] = useState(false);
  const [captureErrorMsg, setCaptureErrorMsg] = useState("");
  const [lastCapturedSnippet, setLastCapturedSnippet] = useState("");
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>("api");
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [autoStartOnCall, setAutoStartOnCall] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechShouldRunRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const callIdRef = useRef("");
  const transcribeQueueRef = useRef(Promise.resolve());

  const captureSupported = typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== "undefined";
  const browserSpeechSupported = !!getSpeechRecognitionConstructor();
  const endpointConfigured = !!API_CONFIG.TRANSCRIBE_ENDPOINT;

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  const releaseCaptureResources = useCallback(() => {
    stopStream(micStreamRef.current);
    stopStream(systemStreamRef.current);
    stopStream(mixedStreamRef.current);
    micStreamRef.current = null;
    systemStreamRef.current = null;
    mixedStreamRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const enqueueTranscription = useCallback((chunkBlob: Blob) => {
    if (chunkBlob.size === 0) return;
    transcribeQueueRef.current = transcribeQueueRef.current.then(async () => {
      setCaptureProcessing(true);
      try {
        const activeCallId = callIdRef.current || `CALL-${Date.now()}`;
        const text = await transcribeAudioChunk(chunkBlob, activeCallId);
        if (!text) return;
        setLastCapturedSnippet(text);
        setChunk(text);
        setFullTranscript((prev) => (prev ? `${prev}\n${text}` : text));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Transcription failed";
        setCaptureErrorMsg(message);
      } finally {
        setCaptureProcessing(false);
      }
    });
  }, []);

  const stopLiveCapture = useCallback(() => {
    speechShouldRunRef.current = false;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // no-op
      }
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      releaseCaptureResources();
    }
    setCaptureListening(false);
    setCaptureProcessing(false);
  }, [releaseCaptureResources]);

  const startLiveCapture = useCallback(async () => {
    if (captureListening) return;

    setCaptureErrorMsg("");

    const currentCallId = callIdRef.current || `CALL-${Date.now()}`;
    if (!callIdRef.current) {
      callIdRef.current = currentCallId;
      setCallId(currentCallId);
    }

    try {
      if (transcriptionMode === "browser") {
        const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
        if (!SpeechRecognitionCtor) {
          setCaptureErrorMsg("Browser Speech Recognition is not supported.");
          return;
        }

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          let finalText = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result?.isFinal) continue;
            const alt = result[0];
            if (alt?.transcript) finalText += `${alt.transcript} `;
          }
          finalText = finalText.trim();
          if (!finalText) return;

          setLastCapturedSnippet(finalText);
          setChunk(finalText);
          setFullTranscript((prev) => (prev ? `${prev}\n${finalText}` : finalText));
        };

        recognition.onerror = (event) => {
          setCaptureErrorMsg(event.message || `Speech recognition error: ${event.error}`);
        };

        recognition.onend = () => {
          if (!speechShouldRunRef.current) return;
          try {
            recognition.start();
          } catch {
            setCaptureListening(false);
          }
        };

        speechShouldRunRef.current = true;
        recognition.start();
        speechRecognitionRef.current = recognition;
        setCaptureListening(true);
        return;
      }

      if (!captureSupported) {
        setCaptureErrorMsg("Browser does not support required audio capture APIs.");
        return;
      }
      if (!endpointConfigured) {
        setCaptureErrorMsg("Transcription endpoint not configured. Set VITE_TRANSCRIBE_ENDPOINT.");
        return;
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = micStream;

      let systemStream: MediaStream | null = null;
      if (includeSystemAudio) {
        systemStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        if (systemStream.getAudioTracks().length === 0) {
          throw new Error("No system audio track selected. Re-run and enable audio share.");
        }
        systemStreamRef.current = systemStream;
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      if (systemStream) {
        const systemSource = audioContext.createMediaStreamSource(systemStream);
        systemSource.connect(destination);
      }

      const mixedStream = destination.stream;
      if (mixedStream.getAudioTracks().length === 0) {
        throw new Error("No audio tracks available for recording.");
      }
      mixedStreamRef.current = mixedStream;

      const mimeType = getSupportedAudioMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(mixedStream, recorderOptions);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          enqueueTranscription(event.data);
        }
      };

      recorder.onerror = () => {
        setCaptureErrorMsg("Audio recorder failed.");
      };

      recorder.onstop = () => {
        releaseCaptureResources();
      };

      if (systemStream) {
        systemStream.getTracks().forEach((track) => {
          track.addEventListener("ended", () => {
            stopLiveCapture();
          });
        });
      }

      recorder.start(5000);
      setCaptureListening(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to start audio capture.";
      setCaptureErrorMsg(message);
      stopLiveCapture();
    }
  }, [
    captureListening,
    transcriptionMode,
    captureSupported,
    browserSpeechSupported,
    endpointConfigured,
    includeSystemAudio,
    enqueueTranscription,
    stopLiveCapture,
  ]);

  const startCall = useCallback(() => {
    const id = callId || `CALL-${Date.now()}`;
    setCallId(id);
    setCallActive(true);
    setCallStage("start");
    setAiResponse(null);
    setErrorMsg("");
    setStatus("idle");
    if (autoStartOnCall) {
      void startLiveCapture();
    }
  }, [callId, autoStartOnCall, startLiveCapture]);

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
        stopLiveCapture();
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Request failed");
      setStatus("error");
    }
  }, [callId, techId, chunk, fullTranscript, callStage, issueCtx, prevRecs, ticketFields, useMock, stopLiveCapture]);

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

  useEffect(() => {
    return () => {
      stopLiveCapture();
    };
  }, [stopLiveCapture]);

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
        <LiveCaptureCard
          listening={captureListening}
          processing={captureProcessing}
          transcriptionMode={transcriptionMode}
          setTranscriptionMode={setTranscriptionMode}
          includeSystemAudio={includeSystemAudio}
          setIncludeSystemAudio={setIncludeSystemAudio}
          autoStartOnCall={autoStartOnCall}
          setAutoStartOnCall={setAutoStartOnCall}
          endpointConfigured={endpointConfigured}
          captureSupported={captureSupported}
          browserSpeechSupported={browserSpeechSupported}
          lastSnippet={lastCapturedSnippet}
          errorMsg={captureErrorMsg}
          onStart={() => void startLiveCapture()}
          onStop={stopLiveCapture}
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
