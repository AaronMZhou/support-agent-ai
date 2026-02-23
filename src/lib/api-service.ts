import { API_CONFIG } from "./api-config";
import { MOCK_QUERY_RESPONSE, MOCK_INGEST_RESPONSE } from "./mock-data";
import type {
  QueryRequest,
  QueryResponse,
  IngestRequest,
  IngestResponse,
  ApiLog,
  ApiErrorResponse,
  TranscribeResponse,
} from "./types";

let apiLogs: ApiLog[] = [];
let logListeners: Array<(logs: ApiLog[]) => void> = [];

export function subscribeToLogs(cb: (logs: ApiLog[]) => void) {
  logListeners.push(cb);
  return () => { logListeners = logListeners.filter(l => l !== cb); };
}

function pushLog(log: ApiLog) {
  apiLogs = [log, ...apiLogs].slice(0, 50);
  logListeners.forEach(cb => cb(apiLogs));
}

export function getLastLog(): ApiLog | null {
  return apiLogs[0] ?? null;
}

export function getLogs(): ApiLog[] {
  return apiLogs;
}

async function apiCall<T>(endpoint: string, body: unknown, mockResponse: T, useMock: boolean): Promise<{ data: T; status: number; log: ApiLog }> {
  const logEntry: ApiLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    endpoint,
    method: "POST",
    requestBody: body,
    responseBody: null,
    status: null,
    durationMs: null,
  };

  if (useMock) {
    logEntry.responseBody = mockResponse;
    logEntry.status = 200;
    logEntry.durationMs = 42;
    pushLog(logEntry);
    return { data: mockResponse, status: 200, log: logEntry };
  }

  const start = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const elapsed = Math.round(performance.now() - start);
    let data: T;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Non-JSON response (status ${res.status})`);
    }

    logEntry.responseBody = data;
    logEntry.status = res.status;
    logEntry.durationMs = elapsed;
    pushLog(logEntry);

    // Check for API-level error
    if ((data as any)?.success === false) {
      throw new Error((data as ApiErrorResponse).error || "API returned error");
    }

    return { data, status: res.status, log: logEntry };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    logEntry.durationMs = elapsed;
    logEntry.status = logEntry.status ?? 0;
    logEntry.responseBody = logEntry.responseBody ?? { error: err.message };
    pushLog(logEntry);
    throw err;
  }
}

export async function sendQuery(req: QueryRequest, useMock: boolean): Promise<QueryResponse> {
  const { data } = await apiCall<QueryResponse>(
    API_CONFIG.QUERY_ENDPOINT,
    req,
    MOCK_QUERY_RESPONSE,
    useMock,
  );
  return data;
}

export async function ingestArticle(req: IngestRequest, useMock: boolean): Promise<IngestResponse> {
  const { data } = await apiCall<IngestResponse>(
    API_CONFIG.INGEST_ENDPOINT,
    req,
    MOCK_INGEST_RESPONSE,
    useMock,
  );
  return data;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

function extractTranscript(data: TranscribeResponse): string {
  if (typeof data.transcript === "string" && data.transcript.trim()) return data.transcript.trim();
  if (typeof data.text === "string" && data.text.trim()) return data.text.trim();
  return "";
}

export async function transcribeAudioChunk(audioBlob: Blob, callId: string): Promise<string> {
  if (!API_CONFIG.TRANSCRIBE_ENDPOINT) {
    throw new Error("Transcription endpoint is not configured (VITE_TRANSCRIBE_ENDPOINT)");
  }

  const endpoint = API_CONFIG.TRANSCRIBE_ENDPOINT;
  const logEntry: ApiLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    endpoint,
    method: "POST",
    requestBody: {
      callId,
      sizeBytes: audioBlob.size,
      mimeType: audioBlob.type || "audio/webm",
    },
    responseBody: null,
    status: null,
    durationMs: null,
  };

  const formData = new FormData();
  formData.append("file", audioBlob, `call-${callId}-${Date.now()}.webm`);
  formData.append("callId", callId);

  const start = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    const elapsed = Math.round(performance.now() - start);
    let data: TranscribeResponse;
    try {
      data = (await res.json()) as TranscribeResponse;
    } catch {
      throw new Error(`Non-JSON transcription response (status ${res.status})`);
    }

    logEntry.responseBody = data;
    logEntry.status = res.status;
    logEntry.durationMs = elapsed;
    pushLog(logEntry);

    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : `Transcription request failed (status ${res.status})`);
    }
    if (data.success === false) {
      throw new Error(typeof data.error === "string" ? data.error : "Transcription API returned error");
    }

    const transcript = extractTranscript(data);
    if (!transcript) {
      throw new Error("Transcription response missing transcript/text");
    }

    return transcript;
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - start);
    logEntry.durationMs = elapsed;
    logEntry.status = logEntry.status ?? 0;
    logEntry.responseBody = logEntry.responseBody ?? { error: getErrorMessage(err) };
    pushLog(logEntry);
    throw err;
  }
}
