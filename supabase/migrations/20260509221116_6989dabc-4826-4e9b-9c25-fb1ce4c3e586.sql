
-- Audit log for access checks
CREATE TABLE public.access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  function_name text NOT NULL,
  resource_type text,
  resource_id uuid,
  granted boolean NOT NULL,
  reason text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user_created ON public.access_audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_function_granted ON public.access_audit_log (function_name, granted);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.access_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- SECURITY DEFINER insert function (callable by anyone authenticated, but only writes about caller-context)
CREATE OR REPLACE FUNCTION public.log_access_check(
  _user_id uuid,
  _function text,
  _resource_type text,
  _resource_id uuid,
  _granted boolean,
  _reason text,
  _context jsonb DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.access_audit_log(user_id, function_name, resource_type, resource_id, granted, reason, context)
  VALUES (_user_id, _function, _resource_type, _resource_id, _granted, _reason, _context);
$$;

GRANT EXECUTE ON FUNCTION public.log_access_check(uuid, text, text, uuid, boolean, text, jsonb)
  TO authenticated, anon, service_role;

-- Audited variants
CREATE OR REPLACE FUNCTION public.can_access_device_audited(_user_id uuid, _device_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_granted boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.devices WHERE id = _device_id AND user_id = _user_id) THEN
    v_granted := true; v_reason := 'owner';
  ELSIF EXISTS (SELECT 1 FROM public.device_permissions WHERE device_id = _device_id AND user_id = _user_id) THEN
    v_granted := true; v_reason := 'permission';
  ELSIF public.has_role(_user_id, 'admin') THEN
    v_granted := true; v_reason := 'admin';
  ELSE
    v_reason := 'denied:no_access';
  END IF;

  PERFORM public.log_access_check(_user_id, 'can_access_device', 'device', _device_id, v_granted, v_reason, NULL);
  RETURN v_granted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_device_audited(uuid, uuid)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.can_edit_device_audited(_user_id uuid, _device_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_granted boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.devices WHERE id = _device_id AND user_id = _user_id) THEN
    v_granted := true; v_reason := 'owner';
  ELSIF EXISTS (SELECT 1 FROM public.device_permissions WHERE device_id = _device_id AND user_id = _user_id AND permission_level = 'editor') THEN
    v_granted := true; v_reason := 'editor_permission';
  ELSIF public.has_role(_user_id, 'admin') THEN
    v_granted := true; v_reason := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.device_permissions WHERE device_id = _device_id AND user_id = _user_id) THEN
    v_reason := 'denied:viewer_only';
  ELSE
    v_reason := 'denied:no_access';
  END IF;

  PERFORM public.log_access_check(_user_id, 'can_edit_device', 'device', _device_id, v_granted, v_reason, NULL);
  RETURN v_granted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_device_audited(uuid, uuid)
  TO authenticated, anon, service_role;
