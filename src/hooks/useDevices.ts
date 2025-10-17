import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Device {
  id: string;
  device_name: string;
  device_id: string;
  mac_address: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceStatus {
  id: string;
  device_id: string;
  display_active: boolean;
  wifi_connected: boolean;
  usb_host_active: boolean;
  transfer_active: boolean;
  storage_used_mb: number;
  total_backups: number;
  created_at: string;
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("devices-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
        },
        (payload) => {
          console.log("Device change:", payload);
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDevices(data || []);
      
      // Auto-select first device if none selected
      if (!selectedDevice && data && data.length > 0) {
        setSelectedDevice(data[0]);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    devices,
    selectedDevice,
    setSelectedDevice,
    loading,
    refetch: fetchDevices,
  };
}

export function useDeviceStatus(deviceId: string | undefined) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    fetchStatus();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`device-status-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_status",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          console.log("Status change:", payload);
          setStatus(payload.new as DeviceStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  const fetchStatus = async () => {
    if (!deviceId) return;

    try {
      const { data, error } = await supabase
        .from("device_status")
        .select("*")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error("Error fetching device status:", error);
    } finally {
      setLoading(false);
    }
  };

  return { status, loading, refetch: fetchStatus };
}
