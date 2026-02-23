// ---- Query API Types ----

export type CallAction = "analyze_transcript" | "continue_call" | "end_call";
export type CallStage = "start" | "middle" | "late" | "end";
export type StepStatus = "tried" | "not_tried" | "worked" | "failed";
export type RiskLevel = "low" | "medium" | "high";
export type ResolutionStatus = "unresolved" | "resolved" | "workaround_provided" | "escalate";
export type RequestStatus = "idle" | "sending" | "success" | "error";

export interface IssueContext {
  deviceType: string;
  os: string;
  software: string[];
  userReportedProblem: string;
  errorMessages: string[];
  location: string;
}

export interface PreviousRecommendation {
  step: string;
  status: StepStatus;
}

export interface TicketFields {
  requesterName: string;
  department: string;
  priority: string;
}

export interface QueryRequest {
  action: CallAction;
  callId: string;
  technicianId?: string;
  transcriptChunk: string;
  fullTranscriptSoFar?: string;
  callStage?: CallStage;
  issueContext?: Partial<IssueContext>;
  previousRecommendations?: PreviousRecommendation[];
  ticketFields?: Partial<TicketFields>;
}

export interface LikelyCause {
  cause: string;
  why: string;
  rank: number;
}

export interface RecommendedStep {
  stepNumber: number;
  action: string;
  reason: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
}

export interface DocReference {
  title: string;
  articleId: string;
  relevance: string;
}

export interface EscalationRecommendation {
  shouldEscalate: boolean;
  reason: string;
}

export interface TicketDraft {
  shortTitle: string;
  category: string;
  problemSummary: string;
  observedSymptoms: string[];
  stepsAttempted: string[];
  recommendedNextAction: string;
  resolutionStatus: ResolutionStatus;
  notes: string;
}

export interface QueryResponse {
  issueSummary: string;
  likelyCauses: LikelyCause[];
  recommendedNextSteps: RecommendedStep[];
  clarifyingQuestions: string[];
  documentationReferences: DocReference[];
  confidence: number;
  escalationRecommendation: EscalationRecommendation;
  ticketDraft: TicketDraft;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details: string;
}

// ---- Ingest API Types ----

export interface IngestRequest {
  articleId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  sourceUrl?: string;
  lastUpdated?: string;
}

export interface IngestSuccessResponse {
  success: true;
  articleId: string;
  title: string;
  chunksCreated: number;
  message: string;
}

export type IngestResponse = IngestSuccessResponse | ApiErrorResponse;

// ---- Debug Log ----

export interface ApiLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  requestBody: unknown;
  responseBody: unknown;
  status: number | null;
  durationMs: number | null;
}
