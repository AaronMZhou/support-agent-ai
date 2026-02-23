import type { QueryResponse, IngestSuccessResponse } from "./types";

export const DEMO_TRANSCRIPT =
  "User reports Outlook keeps crashing on startup after a recent update. Error appears briefly and closes. Reboot already attempted. User is on Windows 11 and has tried reopening multiple times.";

export const DEMO_ARTICLE = {
  articleId: "OUTLOOK-STARTUP-001",
  title: "Outlook Crashes on Startup After Update",
  category: "Email",
  tags: "outlook, crash, windows11, startup",
  sourceUrl: "https://asctech.kb/articles/OUTLOOK-STARTUP-001",
  content: `# Outlook Crashes on Startup After Update

## Symptoms
- Outlook closes immediately or within seconds of launching
- Brief error flash may appear
- Issue began after a Windows or Office update

## Troubleshooting Steps

### 1. Start Outlook in Safe Mode
Run: \`outlook.exe /safe\`
If Outlook opens in Safe Mode, an add-in is likely the cause.

### 2. Disable Add-ins
Go to File > Options > Add-ins > Manage COM Add-ins > Go
Uncheck all add-ins and restart Outlook normally.
Re-enable one at a time to identify the problematic add-in.

### 3. Repair Office Installation
Control Panel > Programs > Microsoft 365 > Change > Quick Repair
If Quick Repair fails, try Online Repair.

### 4. Create a New Outlook Profile
Control Panel > Mail > Show Profiles > Add
Create a new profile and set it as default.

### 5. Check for Corrupt Data Files
Run: \`scanpst.exe\` (Inbox Repair Tool)
Default location: C:\\Program Files\\Microsoft Office\\root\\Office16

### 6. Update Office
File > Office Account > Update Options > Update Now

## Escalation
If none of the above steps resolve the issue, escalate to Tier 2 with:
- Safe Mode test results
- Add-in list
- Repair attempt results
- Event Viewer logs (Application section)`,
};

export const MOCK_QUERY_RESPONSE: QueryResponse = {
  issueSummary:
    "Outlook is crashing on startup after a recent Windows/Office update on a Windows 11 machine. The user has already attempted rebooting without success.",
  likelyCauses: [
    { cause: "Conflicting Outlook add-in", why: "Updates can break add-in compatibility, causing startup crashes", rank: 1 },
    { cause: "Corrupt Outlook profile", why: "Profile data may have been corrupted during the update process", rank: 2 },
    { cause: "Damaged Office installation files", why: "Update may have incompletely installed or corrupted Office binaries", rank: 3 },
  ],
  recommendedNextSteps: [
    { stepNumber: 1, action: "Launch Outlook in Safe Mode (outlook.exe /safe)", reason: "Isolates whether an add-in is causing the crash", riskLevel: "low", requiresConfirmation: false },
    { stepNumber: 2, action: "Disable all COM add-ins and restart normally", reason: "Identifies if a specific add-in is the root cause", riskLevel: "low", requiresConfirmation: false },
    { stepNumber: 3, action: "Run Quick Repair on Office installation", reason: "Fixes corrupted or missing Office files", riskLevel: "low", requiresConfirmation: false },
    { stepNumber: 4, action: "Create a new Outlook profile", reason: "Eliminates corrupt profile as a cause", riskLevel: "medium", requiresConfirmation: true },
    { stepNumber: 5, action: "Run scanpst.exe on data files", reason: "Repairs corrupted PST/OST data files", riskLevel: "medium", requiresConfirmation: true },
  ],
  clarifyingQuestions: [
    "Does Outlook open successfully in Safe Mode?",
    "Were any new add-ins installed recently?",
    "Is the user's mailbox on Exchange Online or on-premises?",
    "Are other Office applications working normally?",
  ],
  documentationReferences: [
    { title: "Outlook Crashes on Startup After Update", articleId: "OUTLOOK-STARTUP-001", relevance: "Directly addresses this exact scenario with step-by-step troubleshooting" },
  ],
  confidence: 0.87,
  escalationRecommendation: {
    shouldEscalate: false,
    reason: "Multiple standard troubleshooting steps remain to be tried before escalation is warranted.",
  },
  ticketDraft: {
    shortTitle: "Outlook Crash on Startup - Post Update",
    category: "Email / Outlook",
    problemSummary: "User's Outlook application crashes immediately on startup following a recent Windows/Office update. Rebooting the machine has not resolved the issue.",
    observedSymptoms: [
      "Outlook closes within seconds of launching",
      "Brief error flash visible before crash",
      "Issue began after recent update",
      "Reboot did not resolve",
    ],
    stepsAttempted: ["Rebooted machine - no improvement"],
    recommendedNextAction: "Launch Outlook in Safe Mode to determine if an add-in is causing the crash",
    resolutionStatus: "unresolved",
    notes: "User is on Windows 11. Multiple reopen attempts failed. Next step is Safe Mode testing.",
  },
};

export const MOCK_INGEST_RESPONSE: IngestSuccessResponse = {
  success: true,
  articleId: "OUTLOOK-STARTUP-001",
  title: "Outlook Crashes on Startup After Update",
  chunksCreated: 12,
  message: "Article ingested into vector store",
};
