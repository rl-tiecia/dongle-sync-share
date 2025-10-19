-- Fix database functions to set explicit search_path for security

-- Fix cleanup_expired_claims function
CREATE OR REPLACE FUNCTION public.cleanup_expired_claims()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.device_claims
  WHERE expires_at < now() AND is_used = false;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;