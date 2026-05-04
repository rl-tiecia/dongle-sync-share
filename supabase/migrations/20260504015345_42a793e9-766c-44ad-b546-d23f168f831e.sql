
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.device_secrets (
  device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
  device_token TEXT,
  claim_code TEXT UNIQUE,
  token_retrieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.device_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.device_secrets (device_id, device_token, claim_code)
SELECT id, device_token, claim_code FROM public.devices
WHERE device_token IS NOT NULL OR claim_code IS NOT NULL
ON CONFLICT (device_id) DO NOTHING;

ALTER TABLE public.devices DROP COLUMN device_token;
ALTER TABLE public.devices DROP COLUMN claim_code;

CREATE POLICY "Owners and admins can view secrets" ON public.device_secrets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_secrets.device_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Owners and admins can manage secrets" ON public.device_secrets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_secrets.device_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_secrets.device_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER device_secrets_updated_at BEFORE UPDATE ON public.device_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Owners and admins can update devices" ON public.devices;
CREATE POLICY "Owners and admins can update devices" ON public.devices
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.device_permissions dp WHERE dp.device_id = devices.id AND dp.user_id = auth.uid() AND dp.permission_level = 'editor')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (
      EXISTS (SELECT 1 FROM public.device_permissions dp WHERE dp.device_id = devices.id AND dp.user_id = auth.uid() AND dp.permission_level = 'editor')
      AND user_id = (SELECT d2.user_id FROM public.devices d2 WHERE d2.id = devices.id)
    )
  );

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_device(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit_device(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
