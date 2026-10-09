# ASCTech AI Call Assistant

Internal tool for IT support technicians: live call transcript, documentation-grounded
troubleshooting suggestions, and a reliable ticket pipeline.

## How it works

```text
Call transcript ──> n8n + LLM ──> ticket fields (draft)
                                      │  technician reviews / edits
                                      ▼
                 submit-ticket ──> ticket_jobs queue (unique idempotency key)
                                      │  claim_ticket_jobs lease, bounded batches
                                      ▼
                 process-ticket-queue ──> ticketing API (Idempotency-Key)
                        │ retryable error: exponential backoff + jitter
                        └ max attempts / non-retryable: dead-letter list (manual retry)
```

The LLM only fills in the ticket fields. The queue, deduplication, retries, dead-letter
handling, database, API and dashboard are ordinary backend code.

## Tests

`npm test` runs:

- Unit tests for draft parsing, idempotency keys, edit detection, backoff and retry policy.
- An integration test against a real HTTP mock ticketing API that injects failures,
  including "ticket saved but response lost". Current run: 450 submissions for 150 calls,
  91 injected failures (51 lost responses), 150 tickets, 0 duplicates.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and a production build on every push and PR.

## Resume bullets (engineering first)

- Built a queue between call intake and ticket creation (Postgres + TypeScript edge functions) with lease-based job claiming, idempotent creation, exponential backoff with jitter, and a dead-letter queue; zero duplicate tickets across 91 injected failures in the integration suite.
- Wrote unit tests for parsing and dedup plus HTTP integration tests against a mock ticketing API with failure injection, run in GitHub Actions.
- Built the technician dashboard (queue status, dead-letter retry, usage metrics) and auth; the LLM only fills in ticket fields.
- Usage at ASCTech: **[tickets/week]**, **[N] technicians**, **[X]%** of tickets accepted without edits. Fill these in from the Tickets page after real use.

Note: the backend is TypeScript (Deno). A Go or Java version would need to be hosted outside this project.
