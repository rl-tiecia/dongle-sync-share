
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ DEVICES ============
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_name TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  mac_address TEXT,
  firmware_version TEXT,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN NOT NULL DEFAULT false,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claim_code TEXT UNIQUE,
  claimed_at TIMESTAMPTZ,
  device_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- ============ DEVICE PERMISSIONS ============
CREATE TABLE public.device_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'viewer' CHECK (permission_level IN ('viewer', 'editor')),
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, user_id)
);
-- FK with explicit name expected by code (device_permissions_user_id_fkey to profiles)
ALTER TABLE public.device_permissions
  ADD CONSTRAINT device_permissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.device_permissions ENABLE ROW LEVEL SECURITY;

-- Helper: can user access a device?
CREATE OR REPLACE FUNCTION public.can_access_device(_user_id UUID, _device_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.devices WHERE id = _device_id AND user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.device_permissions WHERE device_id = _device_id AND user_id = _user_id)
    OR public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.can_edit_device(_user_id UUID, _device_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.devices WHERE id = _device_id AND user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.device_permissions WHERE device_id = _device_id AND user_id = _user_id AND permission_level = 'editor')
    OR public.has_role(_user_id, 'admin')
$$;

-- ============ DEVICE STATUS ============
CREATE TABLE public.device_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  display_active BOOLEAN NOT NULL DEFAULT false,
  wifi_connected BOOLEAN NOT NULL DEFAULT false,
  usb_host_active BOOLEAN NOT NULL DEFAULT false,
  transfer_active BOOLEAN NOT NULL DEFAULT false,
  storage_used_mb NUMERIC NOT NULL DEFAULT 0,
  total_backups INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;

-- ============ DEVICE LOGS ============
CREATE TABLE public.device_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;

-- ============ DEVICE BACKUPS ============
CREATE TABLE public.device_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size_mb NUMERIC,
  backup_type TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  destination TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.device_backups ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- devices
CREATE POLICY "Users can view accessible devices" ON public.devices
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.device_permissions dp WHERE dp.device_id = devices.id AND dp.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Users can insert their own devices" ON public.devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners and admins can update devices" ON public.devices
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.device_permissions dp WHERE dp.device_id = devices.id AND dp.user_id = auth.uid() AND dp.permission_level = 'editor')
  );
CREATE POLICY "Owners and admins can delete devices" ON public.devices
  FOR DELETE USING (
    auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
  );

-- device_permissions
CREATE POLICY "Users can view permissions for their devices" ON public.device_permissions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_permissions.device_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Owners and admins can manage permissions" ON public.device_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_permissions.device_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_permissions.device_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- device_status / logs / backups: same access pattern via can_access_device, edit via can_edit_device
CREATE POLICY "View status for accessible devices" ON public.device_status
  FOR SELECT USING (public.can_access_device(auth.uid(), device_id));
CREATE POLICY "Insert status for editable devices" ON public.device_status
  FOR INSERT WITH CHECK (public.can_edit_device(auth.uid(), device_id));

CREATE POLICY "View logs for accessible devices" ON public.device_logs
  FOR SELECT USING (public.can_access_device(auth.uid(), device_id));
CREATE POLICY "Insert logs for editable devices" ON public.device_logs
  FOR INSERT WITH CHECK (public.can_edit_device(auth.uid(), device_id));

CREATE POLICY "View backups for accessible devices" ON public.device_backups
  FOR SELECT USING (public.can_access_device(auth.uid(), device_id));
CREATE POLICY "Insert backups for editable devices" ON public.device_backups
  FOR INSERT WITH CHECK (public.can_edit_device(auth.uid(), device_id));

-- ============ TRIGGERS ============

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER devices_updated_at BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REALTIME ============
ALTER TABLE public.devices REPLICA IDENTITY FULL;
ALTER TABLE public.device_status REPLICA IDENTITY FULL;
ALTER TABLE public.device_logs REPLICA IDENTITY FULL;
ALTER TABLE public.device_backups REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_backups;

-- ============ INDEXES ============
CREATE INDEX idx_devices_user_id ON public.devices(user_id);
CREATE INDEX idx_device_status_device_id ON public.device_status(device_id, created_at DESC);
CREATE INDEX idx_device_logs_device_id ON public.device_logs(device_id, created_at DESC);
CREATE INDEX idx_device_backups_device_id ON public.device_backups(device_id, created_at DESC);
CREATE INDEX idx_device_permissions_device_id ON public.device_permissions(device_id);
CREATE INDEX idx_device_permissions_user_id ON public.device_permissions(user_id);
