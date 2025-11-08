import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DevicePermission {
  id: string;
  device_id: string;
  user_id: string;
  permission_level: 'viewer' | 'editor';
  granted_by: string;
  granted_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export function useDevicePermissions(deviceId: string | undefined) {
  const [permissions, setPermissions] = useState<DevicePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    fetchPermissions();
  }, [deviceId]);

  const fetchPermissions = async () => {
    if (!deviceId) return;
    
    try {
      const { data, error } = await supabase
        .from('device_permissions')
        .select(`
          *,
          profiles!device_permissions_user_id_fkey(email, full_name)
        `)
        .eq('device_id', deviceId);

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        permission_level: item.permission_level as 'viewer' | 'editor'
      }));
      
      setPermissions(typedData);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPermission = async (userEmail: string, permissionLevel: 'viewer' | 'editor') => {
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle();

    if (userError || !userData) throw new Error('Usuário não encontrado');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const { error } = await supabase
      .from('device_permissions')
      .insert({
        device_id: deviceId,
        user_id: userData.id,
        permission_level: permissionLevel,
        granted_by: user.id
      });

    if (error) throw error;
    await fetchPermissions();
  };

  const removePermission = async (permissionId: string) => {
    const { error } = await supabase
      .from('device_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;
    await fetchPermissions();
  };

  return {
    permissions,
    loading,
    addPermission,
    removePermission,
    refetch: fetchPermissions
  };
}
