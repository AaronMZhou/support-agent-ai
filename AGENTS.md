# Architecture rules

- The LLM (n8n workflow) only fills ticket fields; queueing, dedup, retries and storage are plain backend code in `supabase/functions`. Why: keeps the reliable path deterministic and testable.
- Pipeline decisions (parsing, idempotency key, backoff, retry policy, failure injection) live in `supabase/functions/_shared/ticket-core.ts` with zero imports. Why: the same code runs in Deno edge functions and in Vitest.
- Ticket creation always goes through the `ticket_jobs` queue, keyed by a unique `idempotency_key` (technician + call). Why: repeated submits and retries can never create a second ticket.
- Workers claim jobs with the `claim_ticket_jobs` lease function (`FOR UPDATE SKIP LOCKED`) and process bounded batches. Why: concurrent runs never take the same job.
- The ticketing API must honor an `Idempotency-Key` header; retryable errors (network, 408, 429, 5xx) back off with full jitter, others go straight to dead letter. Why: lost responses are safe to retry.
- Only edge functions (service role) write `ticket_jobs` and `mock_tickets`; signed-in technicians can read. Why: clients can't forge queue state or idempotency keys.
- Usage metrics are computed from real `ticket_jobs` rows, never seeded. Why: the numbers must reflect actual use.
- Tests run with `vitest run` (unit + HTTP integration with injected failures) in GitHub Actions on every push and PR.
