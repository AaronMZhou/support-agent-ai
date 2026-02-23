import { API_CONFIG } from "./api-config";
import { MOCK_QUERY_RESPONSE, MOCK_INGEST_RESPONSE } from "./mock-data";
import type { QueryRequest, QueryResponse, IngestRequest, IngestResponse, ApiLog, ApiErrorResponse } from "./types";

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
