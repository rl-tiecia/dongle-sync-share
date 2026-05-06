
ALTER TABLE public.device_backups
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS delivery_error_code text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_path text,
  ADD COLUMN IF NOT EXISTS network_destination_id uuid;

CREATE INDEX IF NOT EXISTS idx_device_backups_delivery_pending
  ON public.device_backups (delivery_next_attempt_at)
  WHERE delivery_status IN ('pending','retry');

CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  agent_token text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agents"
  ON public.delivery_agents FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own agents"
  ON public.delivery_agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own agents"
  ON public.delivery_agents FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own agents"
  ON public.delivery_agents FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_delivery_agents_updated_at
  BEFORE UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
