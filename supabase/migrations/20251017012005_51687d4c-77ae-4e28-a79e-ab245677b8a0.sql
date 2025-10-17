-- Criar tabela de dispositivos
CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_name TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  mac_address TEXT,
  firmware_version TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de status dos dispositivos
CREATE TABLE public.device_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  display_active BOOLEAN DEFAULT false,
  wifi_connected BOOLEAN DEFAULT false,
  usb_host_active BOOLEAN DEFAULT false,
  transfer_active BOOLEAN DEFAULT false,
  storage_used_mb BIGINT DEFAULT 0,
  total_backups INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de backups
CREATE TABLE public.device_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size_mb NUMERIC(10, 2),
  backup_type TEXT,
  status TEXT DEFAULT 'completed',
  destination TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de logs
CREATE TABLE public.device_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para devices
CREATE POLICY "Users can view their own devices"
ON public.devices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
ON public.devices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
ON public.devices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
ON public.devices FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para device_status
CREATE POLICY "Users can view status of their devices"
ON public.device_status FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.id = device_status.device_id
  AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can insert status for their devices"
ON public.device_status FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.id = device_status.device_id
  AND devices.user_id = auth.uid()
));

-- RLS Policies para device_backups
CREATE POLICY "Users can view backups of their devices"
ON public.device_backups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.id = device_backups.device_id
  AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can insert backups for their devices"
ON public.device_backups FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.id = device_backups.device_id
  AND devices.user_id = auth.uid()
));

-- RLS Policies para device_logs
CREATE POLICY "Users can view logs of their devices"
ON public.device_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.id = device_logs.device_id
  AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can insert logs for their devices"
ON public.device_logs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.id = device_logs.device_id
  AND devices.user_id = auth.uid()
));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_backups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_logs;