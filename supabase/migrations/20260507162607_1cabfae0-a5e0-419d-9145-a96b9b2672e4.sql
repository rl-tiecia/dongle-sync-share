-- Attempts log
CREATE TABLE public.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  status text NOT NULL, -- 'in_flight' | 'success' | 'error' | 'cancelled'
  error_code text,
  error_message text,
  delivered_path text,
  next_attempt_at timestamptz,
  agent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_attempts_backup ON public.delivery_attempts(backup_id, created_at DESC);

ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attempts for accessible backups"
ON public.delivery_attempts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.device_backups b
  WHERE b.id = delivery_attempts.backup_id
    AND public.can_access_device(auth.uid(), b.device_id)
));

CREATE POLICY "Insert attempts for editable backups"
ON public.delivery_attempts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.device_backups b
  WHERE b.id = delivery_attempts.backup_id
    AND public.can_edit_device(auth.uid(), b.device_id)
));
