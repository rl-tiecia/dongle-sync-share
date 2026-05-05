-- Storage bucket for backup files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('device-backups', 'device-backups', false, 10737418240)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: read access for users who can access the device
-- Path convention: {device_uuid}/{backup_uuid}/{filename}
CREATE POLICY "Users can read backups of accessible devices"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'device-backups'
  AND public.can_access_device(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

CREATE POLICY "Editors can delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'device-backups'
  AND public.can_edit_device(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- Extra columns on device_backups
ALTER TABLE public.device_backups
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS md5_hash text,
  ADD COLUMN IF NOT EXISTS upload_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS upload_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS integrity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;

-- Allow update on backup row by editors (so the device-backup-complete function can update via service role,
-- and so editors may retry/clear errors)
CREATE POLICY "Editors can update backups"
ON public.device_backups
FOR UPDATE
USING (public.can_edit_device(auth.uid(), device_id))
WITH CHECK (public.can_edit_device(auth.uid(), device_id));

CREATE POLICY "Editors can delete backups"
ON public.device_backups
FOR DELETE
USING (public.can_edit_device(auth.uid(), device_id));

-- Network destinations table
CREATE TABLE IF NOT EXISTS public.network_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  name text NOT NULL,
  protocol text NOT NULL CHECK (protocol IN ('smb','nfs')),
  host text NOT NULL,
  share text NOT NULL,
  remote_path text NOT NULL DEFAULT '/',
  username text,
  password text,
  domain text,
  port integer,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.network_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their destinations or device-shared destinations"
ON public.network_destinations FOR SELECT
USING (
  auth.uid() = user_id
  OR (device_id IS NOT NULL AND public.can_access_device(auth.uid(), device_id))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own destinations"
ON public.network_destinations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own destinations"
ON public.network_destinations FOR UPDATE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own destinations"
ON public.network_destinations FOR DELETE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_network_destinations_updated_at
BEFORE UPDATE ON public.network_destinations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_network_destinations_user ON public.network_destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_network_destinations_device ON public.network_destinations(device_id);
CREATE INDEX IF NOT EXISTS idx_device_backups_device_created ON public.device_backups(device_id, created_at DESC);