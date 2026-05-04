ALTER TABLE public.device_logs REPLICA IDENTITY FULL;
ALTER TABLE public.device_status REPLICA IDENTITY FULL;
ALTER TABLE public.device_backups REPLICA IDENTITY FULL;
ALTER TABLE public.devices REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.device_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.device_backups; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.devices; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;