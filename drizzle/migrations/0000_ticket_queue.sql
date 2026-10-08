-- Technician profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in technicians can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ticket creation queue (intake -> ticket)
CREATE TABLE public.ticket_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  call_id text NOT NULL,
  technician_id uuid NOT NULL,
  ai_draft jsonb NOT NULL,
  final_draft jsonb NOT NULL,
  edited boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  external_ticket_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_jobs_ready_idx ON public.ticket_jobs (status, next_attempt_at);
GRANT SELECT ON public.ticket_jobs TO authenticated;
GRANT ALL ON public.ticket_jobs TO service_role;
ALTER TABLE public.ticket_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in technicians can view ticket jobs" ON public.ticket_jobs FOR SELECT TO authenticated USING (true);

-- Tickets stored by the mock ticketing API
CREATE TABLE public.mock_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  call_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mock_tickets TO authenticated;
GRANT ALL ON public.mock_tickets TO service_role;
ALTER TABLE public.mock_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in technicians can view mock tickets" ON public.mock_tickets FOR SELECT TO authenticated USING (true);

-- Lease-based claim: concurrent workers never take the same job
CREATE OR REPLACE FUNCTION public.claim_ticket_jobs(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.ticket_jobs LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ticket_jobs j
  SET status = 'processing', locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
  WHERE j.id IN (
    SELECT id FROM public.ticket_jobs
    WHERE (status = 'pending' AND next_attempt_at <= now())
       OR (status = 'processing' AND locked_until < now())
    ORDER BY next_attempt_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_ticket_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ticket_jobs(integer, integer) TO service_role;