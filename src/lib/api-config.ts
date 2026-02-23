// API endpoint configuration
export const API_CONFIG = {
  QUERY_ENDPOINT: "https://zhoumaaron.app.n8n.cloud/webhook/it-support-agent/query",
  INGEST_ENDPOINT: "https://zhoumaaron.app.n8n.cloud/webhook-test/it-support-agent/ingest",
  TRANSCRIBE_ENDPOINT: import.meta.env.VITE_TRANSCRIBE_ENDPOINT ?? "",
} as const;
