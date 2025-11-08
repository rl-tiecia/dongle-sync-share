-- Tabela para gerenciar permissões de compartilhamento
CREATE TABLE public.device_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_level text NOT NULL DEFAULT 'viewer',
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  granted_at timestamp with time zone DEFAULT now(),
  UNIQUE(device_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.device_permissions ENABLE ROW LEVEL SECURITY;

-- Donos de dispositivos podem gerenciar permissões
CREATE POLICY "Device owners can manage permissions"
ON public.device_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.devices
    WHERE devices.id = device_permissions.device_id
    AND devices.user_id = auth.uid()
  )
);

-- Usuários podem ver permissões que foram concedidas a eles
CREATE POLICY "Users can view their permissions"
ON public.device_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Admins podem ver todas as permissões
CREATE POLICY "Admins can view all permissions"
ON public.device_permissions
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Função helper para verificar acesso ao dispositivo
CREATE OR REPLACE FUNCTION public.has_device_access(_device_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devices
    WHERE devices.id = _device_id
    AND (
      devices.user_id = _user_id
      OR public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.device_permissions
        WHERE device_permissions.device_id = _device_id
        AND device_permissions.user_id = _user_id
      )
    )
  )
$$;

-- Atualizar policies da tabela devices
DROP POLICY IF EXISTS "Users can view their own devices" ON public.devices;

CREATE POLICY "Users can view own and shared devices"
ON public.devices
FOR SELECT
USING (
  auth.uid() = user_id
  OR 
  public.is_admin(auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.device_permissions
    WHERE device_permissions.device_id = devices.id
    AND device_permissions.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own devices" ON public.devices;

CREATE POLICY "Owners and admins can update devices"
ON public.devices
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR 
  public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own devices" ON public.devices;

CREATE POLICY "Owners and admins can delete devices"
ON public.devices
FOR DELETE
USING (
  auth.uid() = user_id 
  OR 
  public.is_admin(auth.uid())
);

-- Atualizar policies de device_status
DROP POLICY IF EXISTS "Users can view status of their devices" ON public.device_status;

CREATE POLICY "Users can view status of accessible devices"
ON public.device_status
FOR SELECT
USING (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert status for their devices" ON public.device_status;

CREATE POLICY "Users can insert status for accessible devices"
ON public.device_status
FOR INSERT
WITH CHECK (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update status of their devices" ON public.device_status;

CREATE POLICY "Users can update status of accessible devices"
ON public.device_status
FOR UPDATE
USING (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete status of their devices" ON public.device_status;

CREATE POLICY "Users can delete status of accessible devices"
ON public.device_status
FOR DELETE
USING (public.has_device_access(device_id, auth.uid()));

-- Atualizar policies de device_logs
DROP POLICY IF EXISTS "Users can view logs of their devices" ON public.device_logs;

CREATE POLICY "Users can view logs of accessible devices"
ON public.device_logs
FOR SELECT
USING (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert logs for their devices" ON public.device_logs;

CREATE POLICY "Users can insert logs for accessible devices"
ON public.device_logs
FOR INSERT
WITH CHECK (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update logs of their devices" ON public.device_logs;

CREATE POLICY "Users can update logs of accessible devices"
ON public.device_logs
FOR UPDATE
USING (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete logs of their devices" ON public.device_logs;

CREATE POLICY "Users can delete logs of accessible devices"
ON public.device_logs
FOR DELETE
USING (public.has_device_access(device_id, auth.uid()));

-- Atualizar policies de device_backups
DROP POLICY IF EXISTS "Users can view backups of their devices" ON public.device_backups;

CREATE POLICY "Users can view backups of accessible devices"
ON public.device_backups
FOR SELECT
USING (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert backups for their devices" ON public.device_backups;

CREATE POLICY "Users can insert backups for accessible devices"
ON public.device_backups
FOR INSERT
WITH CHECK (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update backups of their devices" ON public.device_backups;

CREATE POLICY "Users can update backups of accessible devices"
ON public.device_backups
FOR UPDATE
USING (public.has_device_access(device_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete backups of their devices" ON public.device_backups;

CREATE POLICY "Users can delete backups of accessible devices"
ON public.device_backups
FOR DELETE
USING (public.has_device_access(device_id, auth.uid()));