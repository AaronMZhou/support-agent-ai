# ASCTech AI Call Assistant

[![CI](https://github.com/AaronMZhou/support-agent-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/AaronMZhou/support-agent-ai/actions/workflows/ci.yml)

Internal tool for IT support technicians. During a call it transcribes the conversation,
suggests troubleshooting steps grounded in the knowledge base, and drafts the ticket. When
the technician submits the draft, a queue creates exactly one ticket for the call, even
when requests are repeated, connections drop, or responses are lost.

## What it does

- **Call Assistant** – live transcript (browser speech recognition, or microphone plus
  system audio sent to a transcription endpoint), likely causes, recommended steps with
  risk levels, escalation advice, and an editable ticket draft.
- **Tickets** – queue status for every submitted ticket, retry for dead-lettered jobs,
  usage metrics computed from real queue rows, and a failure-rate slider for exercising
  the retry path against the mock ticketing API.
- **Knowledge Base** – ingest support articles into the vector store the assistant
  searches.
- **API Debug** – request and response log for the assistant's API calls.

## Architecture

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

The LLM only fills in ticket fields. Queueing, deduplication, retries and storage are
ordinary backend code:

- **One ticket per call.** Each job is keyed by technician and call. The key is unique in
  `ticket_jobs` and is sent to the ticketing API as an `Idempotency-Key` header, so a
  repeated submit or a retried request returns the existing ticket.
- **Leases.** Workers claim jobs with `claim_ticket_jobs` (`FOR UPDATE SKIP LOCKED`). If a
  worker dies before recording a result, the lease expires and the job is delivered again.
- **Retries.** Network errors, timeouts, 408, 429 and 5xx back off exponentially with full
  jitter. A 2xx response without a ticket id counts as a lost acknowledgment and is
  retried.
- **Dead letter.** Other 4xx responses, invalid drafts and jobs that reach `max_attempts`
  are parked until a technician requeues them from the Tickets page.
- **Access.** Only edge functions (service role) write `ticket_jobs` and `mock_tickets`;
  signed-in technicians can read them.

`mock-ticketing-api` stands in for the real ticketing system. It honors `Idempotency-Key`
and can inject failures, including "ticket saved but response lost".

### Known limitation

There is no scheduled worker yet. The queue runs when a ticket is submitted and while the
Tickets page is open, so a job waiting on backoff is not retried until one of those
happens.

## Project layout

| Path | Contents |
|---|---|
| `src/pages`, `src/components/call-assistant` | Dashboard pages and call-assistant cards |
| `src/lib` | n8n API client, endpoint config, shared types, demo data |
| `supabase/functions/_shared/ticket-core.ts` | Pipeline logic with no imports: draft parsing, idempotency key, backoff, retry policy, HTTP client, batch runner, failure injection |
| `supabase/functions/_shared/queue.ts` | Supabase-backed job store and auth helpers |
| `supabase/functions/submit-ticket` | Validates a draft, enqueues it idempotently, runs a batch |
| `supabase/functions/process-ticket-queue` | Runs a batch; requeues dead-lettered jobs |
| `supabase/functions/mock-ticketing-api` | Stand-in ticketing system |
| `drizzle/migrations` | Tables, row-level security policies and the claim function |
| `src/test` | Unit and integration tests |

`ticket-core.ts` has no imports so the same file runs in Deno edge functions and in
Vitest.

## Running locally

Requires Node 20 or later.

```sh
npm install
npm run dev      # http://localhost:8080
```

Environment variables, read from `.env`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `VITE_TRANSCRIBE_ENDPOINT` | Optional. Transcription service for microphone plus system audio capture |

The n8n webhook URLs for the assistant and for article ingestion are set in
`src/lib/api-config.ts`. The Call Assistant and Knowledge Base pages have a mock toggle
that returns canned responses without calling n8n.

The backend is a Supabase project (Postgres, auth, Deno edge functions) hosted on Lovable
Cloud. The edge functions read `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` from their environment.

## Tests

```sh
npm test
```

- **Unit tests** for draft parsing, idempotency keys, edit detection, backoff and retry
  policy.
- **Fault-injection tests** against a real HTTP mock ticketing API, using the same client
  and batch runner as the edge functions. Injected faults: 503s, dropped connections, and
  lost acknowledgments (502 after write, connection dropped after write, timeout,
  truncated response), plus workers that fail to record a result so the job is delivered
  again. A typical run covers 450 submissions for 150 calls with 100+ injected API
  failures and 30+ lost job saves, and ends with 150 tickets and 0 duplicates. Counts vary
  slightly with request ordering.
- **Dead-letter tests**: backoff doubling up to max attempts, immediate dead letter for a
  rejected ticket, and a requeue that creates exactly one ticket.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and a production build on
pushes to `main` and on pull requests.
